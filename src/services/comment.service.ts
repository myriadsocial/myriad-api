import {BindingScope, injectable, service} from '@loopback/core';
import {
  AnyObject,
  Count,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {ActivityLogType, ReferenceType, SectionType} from '../enums';
import {Comment, CommentWithRelations} from '../models';
import {
  CommentRepository,
  PostRepository,
  TransactionRepository,
} from '../repositories';
import {ActivityLogService} from './activity-log.service';
import {MetricService} from './metric.service';
import {NotificationService} from './notification.service';

@injectable({scope: BindingScope.TRANSIENT})
export class CommentService {
  constructor(
    @repository(CommentRepository)
    private commentRepository: CommentRepository,
    @repository(PostRepository)
    private postRepository: PostRepository,
    @repository(TransactionRepository)
    private transactionRepository: TransactionRepository,
    @service(ActivityLogService)
    private activityLogService: ActivityLogService,
    @service(MetricService)
    private metricService: MetricService,
    @service(NotificationService)
    private notificationService: NotificationService,
  ) {}

  public async find(filter?: Filter<Comment>): Promise<Comment[]> {
    return this.commentRepository.find(filter);
  }

  public async create(data: Omit<Comment, 'id'>): Promise<Comment> {
    return this.postRepository
      .findById(data.postId)
      .then(() => {
        if (data.type === ReferenceType.POST) {
          return this.commentRepository.create(data);
        }

        return this.commentRepository.comments(data.referenceId).create(data);
      })
      .then(comment => this.afterCreate(comment))
      .catch(err => {
        throw err;
      });
  }

  public async deleteById(id: string, userId: string): Promise<Comment> {
    const comment = await this.commentRepository.findOne({
      where: {id, userId},
      include: ['post'],
    });

    if (!comment) throw new HttpErrors.NotFound('CommentNotFound');
    const exclusiveContents = comment?.asset?.exclusiveContents ?? [];
    if (exclusiveContents.length > 0) {
      const transactions = await this.transactionRepository.find({
        where: {
          referenceId: {
            inq: exclusiveContents,
          },
          type: ReferenceType.UNLOCKABLECONTENT,
        },
      });

      if (transactions.length > 0) {
        throw new HttpErrors.UnprocessableEntity('ExlusiveContentExists');
      }
    }

    const data = {
      deletedAt: new Date().toString(),
      deleteByUser: true,
    };

    Object.assign(comment, data);

    return this.commentRepository
      .updateAll(data, {id, userId})
      .then(() => this.afterDelete(comment));
  }

  public async count(where?: Where<Comment>): Promise<Count> {
    return this.commentRepository.count(where);
  }

  // ------------------------------------------------

  // ------ PrivateMethod ----------------------------

  private async afterCreate(comment: Comment): Promise<Comment> {
    const {referenceId, postId, userId} = comment;

    Promise.allSettled([
      this.notificationService.sendPostComment(comment),
      this.metricService.countPopularPost(postId),
      this.metricService.publicMetric(ReferenceType.POST, postId),
      this.metricService.publicMetric(ReferenceType.COMMENT, referenceId),
      this.metricService.userMetric(userId),
      this.metricService.countServerMetric(),
      this.activityLogService.create(
        ActivityLogType.CREATECOMMENT,
        userId,
        ReferenceType.COMMENT,
      ),
    ]) as Promise<AnyObject>;

    return comment;
  }

  private async afterDelete(
    comment: CommentWithRelations,
  ): Promise<CommentWithRelations> {
    const {referenceId, postId, post} = comment;
    const promises = [
      this.metricService.countPopularPost(postId),
      this.metricService.publicMetric(ReferenceType.COMMENT, referenceId),
    ];

    if (post?.metric) {
      const metric = post.metric;
      const [countDebate, countDiscussion] = await Promise.all([
        this.metricService.countComment([postId], SectionType.DEBATE),
        this.metricService.countComment([postId], SectionType.DISCUSSION),
      ]);

      promises.push(
        this.metricService.publicMetric(
          ReferenceType.POST,
          postId,
          false,
          countDiscussion,
          countDebate,
        ),
      );

      post.metric = {
        ...metric,
        discussions: countDiscussion,
        debates: countDebate,
        comments: countDiscussion + countDebate,
      };
    } else {
      promises.push(
        this.metricService.publicMetric(ReferenceType.POST, postId),
      );
    }

    Promise.allSettled(promises) as Promise<AnyObject>;

    return comment;
  }
}

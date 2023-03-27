import {BindingScope, injectable, service} from '@loopback/core';
import {AnyObject, Count, repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {ActivityLogType, ReferenceType, SectionType} from '../enums';
import {Vote} from '../models';
import {CommentRepository, VoteRepository} from '../repositories';
import {ActivityLogService} from './activity-log.service';
import {MetricService} from './metric.service';
import {PostService} from './post.service';
import { NotificationService } from './notification.service';

@injectable({scope: BindingScope.TRANSIENT})
export class VoteService {
  constructor(
    @repository(CommentRepository)
    private commentRepository: CommentRepository,
    @repository(VoteRepository)
    private voteRepository: VoteRepository,
    @service(ActivityLogService)
    private activityLogService: ActivityLogService,
    @service(MetricService)
    private metricService: MetricService,
    @service(PostService)
    private postService: PostService,
    @service(NotificationService)
    private notificationService: NotificationService,
  ) {}

  public async create(vote: Vote): Promise<Vote> {
    const collection = (
      this.voteRepository.dataSource.connector as AnyObject
    ).collection(Vote.modelName);

    return this.beforeCreate(vote)
      .then(() => {
        const query = {
          userId: vote.userId,
          type: vote.type,
          referenceId: vote.referenceId,
        };

        const update = {$set: vote};
        const options = {upsert: true, returnDocument: 'after'};

        return collection.findOneAndUpdate(query, update, options);
      })
      .then((result: AnyObject) => this.afterCreate(result))
      .catch((err: Error) => {
        throw err;
      });
  }

  public async remove(id: string, userId: string): Promise<Count> {
    const vote = await this.beforeDelete(id);

    return this.voteRepository
      .deleteAll({id, userId})
      .then(count => this.afterDelete(vote, count));
  }

  // ------------------------------------------------

  // ------ PrivateMethod ---------------------------

  private async beforeCreate(vote: Vote): Promise<void> {
    const {userId, referenceId, type, state, section} = vote;

    switch (type) {
      case ReferenceType.POST: {
        if (state) return;

        vote.section = undefined;

        const comment = await this.commentRepository.findOne({
          where: {
            userId,
            referenceId,
            type,
            section: SectionType.DEBATE,
          },
        });

        if (comment) return;
        throw new HttpErrors.UnprocessableEntity('CommentFirst');
      }

      case ReferenceType.COMMENT: {
        if (section) return;
        throw new HttpErrors.UnprocessableEntity(
          'Section cannot empty when you upvote/downvote comment',
        );
      }

      default:
        throw new HttpErrors.UnprocessableEntity('Type not found');
    }
  }

  private async afterCreate(result: AnyObject): Promise<Vote> {
    const {_id: id, referenceId, type} = result.value;
    const creator: Promise<string> = new Promise(resolve => {
      if (type === ReferenceType.POST) {
        this.postService
          .findById(referenceId, undefined, true)
          .then(({createdBy}) => {
            resolve(createdBy);
          })
          .catch(() => resolve(''));
      } else {
        this.commentRepository
          .findById(referenceId)
          .then(({userId}) => {
            resolve(userId);
          })
          .catch(() => resolve(''));
      }
    });

    Object.assign(result.value, {id, _id: undefined});

    Promise.allSettled([
      creator.then(toUserId => {
        return this.metric(result.value, toUserId);
      }),
      this.activityLogService.create(
        ActivityLogType.GIVEVOTE,
        referenceId,
        type,
      ),
    ]) as Promise<AnyObject>;

    return new Vote(result.value);
  }

  private async beforeDelete(id: string): Promise<Vote> {
    return this.voteRepository.findById(id);
  }

  private async afterDelete(vote: Vote, count: Count): Promise<Count> {
    this.metric(vote, vote.toUserId) as Promise<void>;

    return count;
  }

  private async metric(voteDetail: AnyObject, toUserId: string): Promise<void> {
    const {id, referenceId, type} = voteDetail;

    await Promise.allSettled([
      this.metricService.countPopularPost(referenceId),
      this.metricService.publicMetric(type, referenceId).then((metric) => {
        if (this.upvoteCounter(metric.upvotes)) {
          this.notificationService.sendVoteCount(type , referenceId).catch((err : Error) => {throw err ;});
        }
      }),
      this.metricService.countServerMetric(),
      this.voteRepository
        .updateById(id.toString(), {toUserId})
        .then(() => this.metricService.userMetric(toUserId)),
    ]);
  }
  private upvoteCounter(upvote : number) : boolean {
    let temp = upvote ;
    while (temp > 10) {
      temp = temp / 10 ;
    }
    if (temp % 10 === 5) {
      return true ;
    }
    else if (temp % 10 === 0) {
      return true ;
    }
    else {
      return false ;
    }
  
  }
}



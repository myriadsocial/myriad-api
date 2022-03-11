import {AnyObject, repository} from '@loopback/repository';
import {ReferenceType, SectionType} from '../enums';
import {CommentRepository, PostRepository} from '../repositories';
import {injectable, BindingScope, service} from '@loopback/core';
import {MetricService} from './metric.service';
import {PostWithRelations, Comment} from '../models';
import {HttpErrors} from '@loopback/rest';

@injectable({scope: BindingScope.TRANSIENT})
export class VoteService {
  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @service(MetricService)
    protected metricService: MetricService,
  ) {}

  async updateVoteCounter(voteDetail: AnyObject): Promise<void> {
    const {referenceId, type, toUserId} = voteDetail;

    if (type === ReferenceType.COMMENT) {
      const commentMetric = await this.metricService.publicMetric(
        type,
        referenceId,
      );
      await this.commentRepository.updateById(referenceId, {
        metric: commentMetric,
      });
    } else {
      const popularCount = await this.metricService.countPopularPost(
        referenceId,
      );
      const postMetric = await this.metricService.publicMetric(
        type,
        referenceId,
      );
      await this.postRepository.updateById(referenceId, {
        popularCount: popularCount,
        metric: postMetric,
      });
    }

    await this.metricService.userMetric(toUserId);
  }

  async validatePostVote(voteDetail: AnyObject): Promise<PostWithRelations> {
    const {userId, referenceId, type, state} = voteDetail;
    const post = await this.postRepository.findById(referenceId, {
      include: [
        {
          relation: 'comments',
          scope: {
            where: {
              userId,
              referenceId,
              type,
              section: SectionType.DEBATE,
            },
          },
        },
      ],
    });

    if (!state) {
      if (!post.comments || (post.comments && post.comments.length === 0)) {
        throw new Error('CommentFirst');
      }
    }

    return post;
  }

  async validateComment(voteDetail: AnyObject): Promise<Comment> {
    const {referenceId, section} = voteDetail;

    if (!section) {
      throw new HttpErrors.UnprocessableEntity(
        'Section cannot empty when you upvote/downvote comment',
      );
    }

    return this.commentRepository.findById(referenceId);
  }
}

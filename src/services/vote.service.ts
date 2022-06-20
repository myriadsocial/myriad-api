import {AnyObject, repository} from '@loopback/repository';
import {ReferenceType, SectionType} from '../enums';
import {
  CommentRepository,
  PostRepository,
  VoteRepository,
} from '../repositories';
import {injectable, BindingScope, service} from '@loopback/core';
import {MetricService} from './metric.service';
import {HttpErrors} from '@loopback/rest';

@injectable({scope: BindingScope.TRANSIENT})
export class VoteService {
  constructor(
    @repository(CommentRepository)
    public commentRepository: CommentRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(VoteRepository)
    protected voteRepository: VoteRepository,
    @service(MetricService)
    protected metricService: MetricService,
  ) {}

  async updateVoteCounter(
    voteDetail: AnyObject,
    toUserId: string,
  ): Promise<void> {
    const {id, referenceId, type} = voteDetail;

    await Promise.allSettled([
      this.metricService.countPopularPost(referenceId),
      this.metricService.publicMetric(type, referenceId),
      this.metricService.countServerMetric(),
      this.voteRepository
        .updateById(id.toString(), {toUserId})
        .then(() => this.metricService.userMetric(toUserId)),
    ]);
  }

  async validateVote(voteDetail: AnyObject): Promise<void> {
    const {userId, referenceId, type, state, section} = voteDetail;

    switch (type) {
      case ReferenceType.POST: {
        if (state) return;

        const comment = await this.commentRepository.findOne({
          where: {
            userId,
            referenceId,
            type,
            section: SectionType.DEBATE,
          },
        });

        if (comment) return;
        throw new Error('CommentFirst');
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
}

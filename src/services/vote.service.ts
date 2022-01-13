import {AnyObject, repository} from '@loopback/repository';
import {ReferenceType} from '../enums';
import {CommentRepository, PostRepository} from '../repositories';
import {injectable, BindingScope, service} from '@loopback/core';
import {MetricService} from './metric.service';

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
    const {referenceId, type, postId, toUserId} = voteDetail;
    const metric = await this.metricService.postMetric(
      type,
      referenceId,
      type === ReferenceType.POST ? referenceId : undefined,
    );
    const popular = await this.metricService.countPopularPost(postId);
    const data: AnyObject = {
      popularCount: popular,
    };

    if (type === ReferenceType.COMMENT) {
      await this.commentRepository.updateById(referenceId, {
        metric,
      });
    } else {
      data.metric = metric;
    }

    await this.postRepository.updateById(referenceId, data);
    await this.metricService.userMetric(toUserId);
  }
}

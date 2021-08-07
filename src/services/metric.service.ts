import {repository} from '@loopback/repository';
import {LikeType} from '../enums';
import {Metric} from '../interfaces';
import {CommentRepository, LikeRepository} from '../repositories';

export class MetricService {
  constructor(
    @repository(LikeRepository)
    protected likeRepository: LikeRepository,
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
  ) {}

  async publicMetric(type: LikeType, referenceId: string): Promise<Metric> {
    const like = await this.likeRepository.count({
      type,
      referenceId,
      state: true,
    });

    const dislike = await this.likeRepository.count({
      type,
      referenceId,
      state: false,
    });

    const comment = await this.commentRepository.count({
      postId: referenceId,
    });

    return {
      likes: like.count,
      dislikes: dislike.count,
      comments: comment.count,
    };
  }
}

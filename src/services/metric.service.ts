import {Count, repository} from '@loopback/repository';
import {
  CommentRepository,
  DislikeRepository,
  LikeRepository,
  PostRepository,
} from '../repositories';
import {Like, Dislike} from '../models';
import {LikeDislikeMetric} from '../interfaces';
import {HttpErrors} from '@loopback/rest';

export class MetricService {
  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(LikeRepository)
    protected likeRepository: LikeRepository,
    @repository(DislikeRepository)
    protected dislikeRepository: DislikeRepository,
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
  ) {}

  async countLikeDislike(postId: string): Promise<void> {
    const likes = await this.likeRepository.count({
      postId: postId,
      status: true,
    });

    const dislikes = await this.dislikeRepository.count({
      postId: postId,
      status: true,
    });

    this.postRepository.publicMetric(postId).patch({
      liked: likes.count,
      disliked: dislikes.count,
    }) as Promise<Count>;

    this.postRepository.updateById(postId, {
      totalLiked: likes.count,
      totalDisliked: dislikes.count,
    }) as Promise<void>;
  }

  async countComment(postId: string): Promise<void> {
    const totalComment = await this.commentRepository.count({postId});

    this.postRepository.updateById(postId, {
      totalComment: totalComment.count + 1,
    }) as Promise<void>;

    this.postRepository
      .publicMetric(postId)
      .patch({comment: totalComment.count + 1}) as Promise<Count>;
  }

  async likeDislikeSystem(
    metric: LikeDislikeMetric,
    isLike: boolean,
  ): Promise<Like | Dislike> {
    if (!metric.postId || !metric.userId) {
      throw new HttpErrors.NotFound('Error');
    }

    // Find like status
    const foundLike = await this.likeRepository.findOne({
      where: {
        postId: metric.postId,
        userId: metric.userId,
      },
    });

    // Find dislike status
    const foundDislike = await this.dislikeRepository.findOne({
      where: {
        postId: metric.postId,
        userId: metric.userId,
      },
    });

    // Not isLike only calculate dislike count
    if (!isLike) {
      // If user doesn't has dislike collection in database
      if (!foundDislike) {
        // Create new dislike collection
        const newDislike = await this.postRepository
          .dislikes(metric.postId)
          .create({
            postId: metric.postId,
            userId: metric.userId,
            status: true,
          });

        // Check if post has been liked by user
        // If true, set status to false
        if (foundLike) {
          if (foundLike.status) {
            await this.likeRepository.updateById(foundLike.id, {status: false});
          }
        }

        // Count total like and dislike
        this.countLikeDislike(metric.postId) as Promise<void>;

        return newDislike;
      }

      // If dislike collection exist
      if (foundDislike.status === false) {
        // Update dislike status to true
        await this.dislikeRepository.updateById(foundDislike.id, {
          status: true,
        });

        // If like status set to true, set it to false
        if (foundLike) {
          if (foundLike.status) {
            await this.likeRepository.updateById(foundLike.id, {status: false});
          }
        }
      } else {
        // Set dislike to false
        await this.dislikeRepository.updateById(foundDislike.id, {
          status: false,
        });
      }

      this.countLikeDislike(metric.postId) as Promise<void>;

      foundDislike.status = !foundDislike.status;

      return foundDislike;

      // isLike only calculate like count
    } else {
      // If user doesn't has like collection in database
      if (!foundLike) {
        // Create a new like collection
        const newLike = await this.postRepository.likes(metric.postId).create({
          userId: metric.userId,
          postId: metric.postId,
          status: true,
        });

        // Check if post has been disliked by user
        // If true, set status to false
        if (foundDislike) {
          if (foundDislike.status) {
            await this.dislikeRepository.updateById(foundDislike.id, {
              status: false,
            });
          }
        }

        // Count total like and dislike
        this.countLikeDislike(metric.postId) as Promise<void>;

        return newLike;
      }

      // If like collection exist
      // then check it its status
      if (!foundLike.status) {
        // Set it to true
        await this.likeRepository.updateById(foundLike.id, {status: true});

        // if dislike statu true, set it false
        if (foundDislike) {
          if (foundDislike.status) {
            await this.dislikeRepository.updateById(foundDislike.id, {
              status: false,
            });
          }
        }
      } else {
        await this.likeRepository.updateById(foundLike.id, {status: false});
      }

      this.countLikeDislike(metric.postId) as Promise<void>;

      foundLike.status = !foundLike.status;

      return foundLike;
    }
  }
}

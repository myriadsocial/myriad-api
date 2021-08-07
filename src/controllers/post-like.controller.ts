import {Count, CountSchema, repository} from '@loopback/repository';
import {del, getModelSchemaRef, param, post, requestBody} from '@loopback/rest';
import {LikeType} from '../enums';
import {Like, Post} from '../models';
import {LikeRepository} from '../repositories';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class PostLikeController {
  constructor(
    @repository(LikeRepository)
    protected likeRepository: LikeRepository,
  ) {}

  @post('/posts/{id}/likes', {
    responses: {
      '200': {
        description: 'Like model instance',
        content: {'application/json': {schema: getModelSchemaRef(Like)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Post.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Like, {
            title: 'NewLike',
            exclude: ['referenceId', 'type'],
          }),
        },
      },
    })
    like: Omit<Like, 'id'>,
  ): Promise<Like> {
    const foundLike = await this.likeRepository.findOne({
      where: {
        userId: like.userId,
        type: LikeType.POST,
        referenceId: id,
      },
    });

    if (foundLike) {
      foundLike.state = !foundLike.state;
      foundLike.updatedAt = new Date().toString();

      await this.likeRepository.updateById(foundLike.id, foundLike);

      return foundLike;
    }

    return this.likeRepository.create(like);
  }

  @del('post/{postId}/likes/{likeId}', {
    responses: {
      '200': {
        description: 'Like DELETE success',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('postId') postId: string,
    @param.path.string('likeId') likeId: string,
  ): Promise<Count> {
    return this.likeRepository.deleteAll({type: LikeType.POST, referenceId: postId, id: likeId});
  }
}

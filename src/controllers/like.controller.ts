import {intercept} from '@loopback/core';
import {repository} from '@loopback/repository';
import {del, getModelSchemaRef, param, post, requestBody} from '@loopback/rest';
import {ValidateLikeInterceptor} from '../interceptors';
import {Like} from '../models';
import {LikeRepository} from '../repositories';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class LikeController {
  constructor(
    @repository(LikeRepository)
    protected likeRepository: LikeRepository,
  ) {}

  @intercept(ValidateLikeInterceptor.BINDING_KEY)
  @post('/likes', {
    responses: {
      '200': {
        description: 'Like model instance',
        content: {'application/json': {schema: getModelSchemaRef(Like)}},
      },
    },
  })
  async createLike(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Like, {
            title: 'NewLike',
            exclude: ['state'],
          }),
        },
      },
    })
    like: Omit<Like, 'id'>,
  ): Promise<Like> {
    return this.likeRepository.create(like);
  }

  @del('/likes/{id}', {
    responses: {
      '200': {
        description: 'Like DELETE success',
      },
    },
  })
  async delete(@param.path.string('id') id: string): Promise<void> {
    return this.likeRepository.deleteById(id);
  }
}

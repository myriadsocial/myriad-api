import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  Dislike,
  User,
} from '../models';
import {DislikeRepository} from '../repositories';

export class DislikeUserController {
  // constructor(
  //   @repository(DislikeRepository)
  //   public dislikeRepository: DislikeRepository,
  // ) { }

  // @get('/dislikes/{id}/user', {
  //   responses: {
  //     '200': {
  //       description: 'User belonging to Dislike',
  //       content: {
  //         'application/json': {
  //           schema: {type: 'array', items: getModelSchemaRef(User)},
  //         },
  //       },
  //     },
  //   },
  // })
  // async getUser(
  //   @param.path.string('id') id: typeof Dislike.prototype.id,
  // ): Promise<User> {
  //   return this.dislikeRepository.user(id);
  // }
}

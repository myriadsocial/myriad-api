import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  Like,
  User,
} from '../models';
import {LikeRepository} from '../repositories';

export class LikeUserController {
  // constructor(
  //   @repository(LikeRepository)
  //   public likeRepository: LikeRepository,
  // ) { }

  // @get('/likes/{id}/user', {
  //   responses: {
  //     '200': {
  //       description: 'User belonging to Like',
  //       content: {
  //         'application/json': {
  //           schema: {type: 'array', items: getModelSchemaRef(User)},
  //         },
  //       },
  //     },
  //   },
  // })
  // async getUser(
  //   @param.path.string('id') id: typeof Like.prototype.id,
  // ): Promise<User> {
  //   return this.likeRepository.user(id);
  // }
}

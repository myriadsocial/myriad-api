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
  Post,
} from '../models';
import {LikeRepository} from '../repositories';

export class LikePostController {
  // constructor(
  //   @repository(LikeRepository)
  //   public likeRepository: LikeRepository,
  // ) { }

  // @get('/likes/{id}/post', {
  //   responses: {
  //     '200': {
  //       description: 'Post belonging to Like',
  //       content: {
  //         'application/json': {
  //           schema: {type: 'array', items: getModelSchemaRef(Post)},
  //         },
  //       },
  //     },
  //   },
  // })
  // async getPost(
  //   @param.path.string('id') id: typeof Like.prototype.id,
  // ): Promise<Post> {
  //   return this.likeRepository.post(id);
  // }
}

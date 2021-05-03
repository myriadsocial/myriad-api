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
  Post,
} from '../models';
import {DislikeRepository} from '../repositories';

export class DislikePostController {
  // constructor(
  //   @repository(DislikeRepository)
  //   public dislikeRepository: DislikeRepository,
  // ) { }

  // @get('/dislikes/{id}/post', {
  //   responses: {
  //     '200': {
  //       description: 'Post belonging to Dislike',
  //       content: {
  //         'application/json': {
  //           schema: {type: 'array', items: getModelSchemaRef(Post)},
  //         },
  //       },
  //     },
  //   },
  // })
  // async getPost(
  //   @param.path.string('id') id: typeof Dislike.prototype.id,
  // ): Promise<Post> {
  //   return this.dislikeRepository.post(id);
  // }
}

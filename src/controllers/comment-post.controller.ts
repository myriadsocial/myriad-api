import {
  repository
} from '@loopback/repository';
import {
  get,
  getModelSchemaRef,
  param
} from '@loopback/rest';
import {
  Comment,
  Post
} from '../models';
import {CommentRepository} from '../repositories';

export class CommentPostController {
  constructor(
    @repository(CommentRepository)
    public commentRepository: CommentRepository,
  ) { }

  @get('/comments/{id}/post', {
    responses: {
      '200': {
        description: 'Post belonging to Comment',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Post)},
          },
        },
      },
    },
  })
  async getPost(
    @param.path.string('id') id: typeof Comment.prototype.id,
  ): Promise<Post> {
    return this.commentRepository.post(id);
  }
}

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
  User
} from '../models';
import {CommentRepository} from '../repositories';

export class CommentUserController {
  constructor(
    @repository(CommentRepository)
    public commentRepository: CommentRepository,
  ) { }

  @get('/comments/{id}/user', {
    responses: {
      '200': {
        description: 'User belonging to Comment',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(User)},
          },
        },
      },
    },
  })
  async getUser(
    @param.path.string('id') id: typeof Comment.prototype.id,
  ): Promise<User> {
    return this.commentRepository.user(id);
  }
}

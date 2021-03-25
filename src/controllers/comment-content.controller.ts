import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  Comment,
  Content,
} from '../models';
import {CommentRepository} from '../repositories';

export class CommentContentController {
  constructor(
    @repository(CommentRepository)
    public commentRepository: CommentRepository,
  ) { }

  @get('/comments/{id}/content', {
    responses: {
      '200': {
        description: 'Content belonging to Comment',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Content)},
          },
        },
      },
    },
  })
  async getContent(
    @param.path.string('id') id: typeof Comment.prototype.id,
  ): Promise<Content> {
    return this.commentRepository.content(id);
  }
}

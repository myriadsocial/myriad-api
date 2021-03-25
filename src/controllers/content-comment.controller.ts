import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import {
  Content,
  Comment,
} from '../models';
import {ContentRepository} from '../repositories';

export class ContentCommentController {
  constructor(
    @repository(ContentRepository) protected contentRepository: ContentRepository,
  ) { }

  @get('/contents/{id}/comments', {
    responses: {
      '200': {
        description: 'Array of Content has many Comment',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Comment)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Comment>,
  ): Promise<Comment[]> {
    return this.contentRepository.comments(id).find(filter);
  }

  @post('/contents/{id}/comments', {
    responses: {
      '200': {
        description: 'Content model instance',
        content: {'application/json': {schema: getModelSchemaRef(Comment)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Content.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Comment, {
            title: 'NewCommentInContent',
            exclude: ['id'],
            optional: ['contentId']
          }),
        },
      },
    }) comment: Omit<Comment, 'id'>,
  ): Promise<Comment> {
    return this.contentRepository.comments(id).create(comment);
  }

  @patch('/contents/{id}/comments', {
    responses: {
      '200': {
        description: 'Content.Comment PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Comment, {partial: true}),
        },
      },
    })
    comment: Partial<Comment>,
    @param.query.object('where', getWhereSchemaFor(Comment)) where?: Where<Comment>,
  ): Promise<Count> {
    return this.contentRepository.comments(id).patch(comment, where);
  }

  @del('/contents/{id}/comments', {
    responses: {
      '200': {
        description: 'Content.Comment DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Comment)) where?: Where<Comment>,
  ): Promise<Count> {
    return this.contentRepository.comments(id).delete(where);
  }
}

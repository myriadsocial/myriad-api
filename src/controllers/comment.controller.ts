import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  response,
} from '@loopback/rest';
import {Comment} from '../models';
import {CommentRepository} from '../repositories';

export class CommentController {
  constructor(
    @repository(CommentRepository)
    public commentRepository : CommentRepository,
  ) {}

  @post('/comments')
  @response(200, {
    description: 'Comment model instance',
    content: {'application/json': {schema: getModelSchemaRef(Comment)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Comment, {
            title: 'NewComment',
            exclude: ['id'],
          }),
        },
      },
    })
    comment: Omit<Comment, 'id'>,
  ): Promise<Comment> {
    return this.commentRepository.create(comment);
  }

  @get('/comments/count')
  @response(200, {
    description: 'Comment model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Comment) where?: Where<Comment>,
  ): Promise<Count> {
    return this.commentRepository.count(where);
  }

  @get('/comments')
  @response(200, {
    description: 'Array of Comment model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Comment, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Comment) filter?: Filter<Comment>,
  ): Promise<Comment[]> {
    return this.commentRepository.find(filter);
  }

  @patch('/comments')
  @response(200, {
    description: 'Comment PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Comment, {partial: true}),
        },
      },
    })
    comment: Comment,
    @param.where(Comment) where?: Where<Comment>,
  ): Promise<Count> {
    return this.commentRepository.updateAll(comment, where);
  }

  @get('/comments/{id}')
  @response(200, {
    description: 'Comment model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Comment, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Comment, {exclude: 'where'}) filter?: FilterExcludingWhere<Comment>
  ): Promise<Comment> {
    return this.commentRepository.findById(id, filter);
  }

  @patch('/comments/{id}')
  @response(204, {
    description: 'Comment PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Comment, {partial: true}),
        },
      },
    })
    comment: Comment,
  ): Promise<void> {
    await this.commentRepository.updateById(id, comment);
  }

  @put('/comments/{id}')
  @response(204, {
    description: 'Comment PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() comment: Comment,
  ): Promise<void> {
    await this.commentRepository.replaceById(id, comment);
  }

  @del('/comments/{id}')
  @response(204, {
    description: 'Comment DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.commentRepository.deleteById(id);
  }
}

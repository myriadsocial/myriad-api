import {intercept} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import {ReferenceType} from '../enums';
import {
  CreateInterceptor,
  DeleteInterceptor,
  FindByIdInterceptor,
  PaginationInterceptor,
  UpdateInterceptor,
} from '../interceptors';
import {Comment} from '../models';
import {CommentRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
export class CommentController {
  constructor(
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/comments', {
    responses: {
      '200': {
        description: 'Array of Comment model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(Comment, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(Comment, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<Comment>,
  ): Promise<Comment[]> {
    return this.commentRepository.find(filter);
  }

  @intercept(FindByIdInterceptor.BINDING_KEY)
  @get('/comments/{id}', {
    responses: {
      '200': {
        description: 'Comment model instances',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Comment, {includeRelations: true}),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Comment, {exclude: 'where'})
    filter?: FilterExcludingWhere<Comment>,
  ): Promise<Comment> {
    return this.commentRepository.findById(id, filter);
  }

  @intercept(CreateInterceptor.BINDING_KEY)
  @post('/comments', {
    responses: {
      '200': {
        description: 'Comment model instance',
        content: {'application/json': {schema: getModelSchemaRef(Comment)}},
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Comment, {
            title: 'NewComment',
            exclude: ['id', 'deleteByUser'],
          }),
        },
      },
    })
    comment: Omit<Comment, 'id'>,
  ): Promise<Comment> {
    if (comment.type === ReferenceType.POST) {
      return this.commentRepository.create(comment);
    }

    return this.commentRepository.comments(comment.referenceId).create(comment);
  }

  @intercept(UpdateInterceptor.BINDING_KEY)
  @patch('/comments/{id}', {
    responses: {
      '204': {
        description: 'Comment PATCH success count',
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Comment, {
            partial: true,
            exclude: [
              'id',
              'type',
              'section',
              'referenceId',
              'deleteByUser',
              'userId',
              'postId',
              'metric',
            ],
          }),
        },
      },
    })
    comment: Partial<Comment>,
  ): Promise<void> {
    return this.commentRepository.updateById(id, comment);
  }

  @intercept(DeleteInterceptor.BINDING_KEY)
  @del('/comments/{id}', {
    responses: {
      '204': {
        description: 'Comment DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.commentRepository.updateById(id, {
      deletedAt: new Date().toString(),
      deleteByUser: true,
    });
  }
}

import {intercept, service} from '@loopback/core';
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
import {PaginationInterceptor} from '../interceptors';
import {Comment} from '../models';
import {CommentRepository} from '../repositories';
import {NotificationService} from '../services';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class CommentController {
  constructor(
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @service(NotificationService)
    protected notificationService: NotificationService,
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
            exclude: ['id'],
          }),
        },
      },
    })
    comment: Omit<Comment, 'id'>,
  ): Promise<Comment> {
    const newComment = await this.commentRepository.create(comment);

    try {
      await this.notificationService.sendPostComment(
        comment.userId,
        newComment,
      );
    } catch (error) {
      // ignored
    }

    return newComment;
  }

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
          schema: getModelSchemaRef(Comment, {partial: true}),
        },
      },
    })
    comment: Partial<Comment>,
  ): Promise<void> {
    return this.commentRepository.updateById(id, comment);
  }

  @del('/comments/{id}', {
    responses: {
      '204': {
        description: 'Comment DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.commentRepository.deleteById(id);
  }
}

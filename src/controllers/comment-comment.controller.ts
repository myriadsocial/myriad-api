import {intercept, service} from '@loopback/core';
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
import {PaginationInterceptor} from '../interceptors';
import {Comment} from '../models';
import {CommentRepository} from '../repositories';
import {NotificationService} from '../services';

export class CommentCommentController {
  constructor(
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @service(NotificationService)
    protected notificationService: NotificationService,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/comments/{id}/comments', {
    responses: {
      '200': {
        description: 'Array of Comment has many Comment through CommentLink',
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
    @param.filter(Comment, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<Comment>,
  ): Promise<Comment[]> {
    return this.commentRepository.comments(id).find(filter);
  }

  @post('/comments/{id}/comments', {
    responses: {
      '200': {
        description: 'create a Comment model instance',
        content: {
          'application/json': {schema: getModelSchemaRef(Comment)},
        },
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Comment.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Comment, {
            title: 'NewCommentInComment',
            exclude: ['id', 'type', 'referenceId'],
          }),
        },
      },
    })
    comment: Omit<Comment, 'id'>,
  ): Promise<Comment> {
    const newComment = await this.commentRepository
      .comments(id)
      .create(comment);

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

  @patch('/comments/{id}/comments', {
    responses: {
      '200': {
        description: 'Comment.Comment PATCH success count',
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
    @param.query.object('where', getWhereSchemaFor(Comment))
    where?: Where<Comment>,
  ): Promise<Count> {
    return this.commentRepository.comments(id).patch(comment, where);
  }

  @del('/comments/{id}/comments', {
    responses: {
      '200': {
        description: 'Comment.Comment DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Comment))
    where?: Where<Comment>,
  ): Promise<Count> {
    return this.commentRepository.comments(id).delete(where);
  }
}

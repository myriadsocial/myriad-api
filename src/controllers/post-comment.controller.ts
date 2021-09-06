import {intercept, service} from '@loopback/core';
import {Count, CountSchema, Filter, repository, Where} from '@loopback/repository';
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
import {PostRepository} from '../repositories';
import {NotificationService} from '../services';

export class PostCommentController {
  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @service(NotificationService)
    protected notificationService: NotificationService,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/posts/{id}/comments', {
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
    @param.path.string('id') id: string,
    @param.filter(Comment, {exclude: ['limit', 'skip', 'offset']}) filter?: Filter<Comment>,
  ): Promise<Comment[]> {
    return this.postRepository.comments(id).find(filter);
  }

  @post('posts/{id}/comments', {
    responses: {
      '200': {
        description: 'Comment model instance',
        content: {'application/json': {schema: getModelSchemaRef(Comment)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Comment, {
            title: 'NewCommentInPost',
            exclude: ['id', 'referenceId', 'type'],
          }),
        },
      },
    })
    comment: Omit<Comment, 'id'>,
  ): Promise<Comment> {
    const newComment = await this.postRepository.comments(id).create(comment);

    try {
      await this.notificationService.sendPostComment(comment.userId, newComment);
    } catch (error) {
      // ignored
    }

    return newComment;
  }

  @patch('/posts/{id}/comments', {
    responses: {
      '200': {
        description: 'Post.Comment PATCH success count',
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
    return this.postRepository.comments(id).patch(comment, where);
  }

  @del('/posts/{id}/comments', {
    responses: {
      '200': {
        description: 'Post.Comment DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Comment)) where?: Where<Comment>,
  ): Promise<Count> {
    return this.postRepository.comments(id).delete(where);
  }
}

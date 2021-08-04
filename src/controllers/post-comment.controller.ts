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
import {defaultFilterQuery} from '../helpers/filter-utils';
import {PaginationInterceptor} from '../interceptors';
import {Comment, Post} from '../models';
import {PostRepository} from '../repositories';
import {MetricService, NotificationService} from '../services';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class PostCommentController {
  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @service(NotificationService)
    protected notificationService: NotificationService,
    @service(MetricService)
    protected metricService: MetricService,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/posts/{id}/comments', {
    responses: {
      '200': {
        description: 'Array of Post has many Comment',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Comment)},
          },
        },
      },
    },
  })
  async findComment(
    @param.path.string('id') id: string,
    @param.path.number('page') page: number,
    @param.filter(Comment, {exclude: ['skip', 'offset']}) filter?: Filter<Comment>,
  ): Promise<Comment[]> {
    filter = defaultFilterQuery(page, filter);
    return this.postRepository.comments(id).find(filter);
  }

  @post('/posts/{id}/comments', {
    responses: {
      '200': {
        description: 'Post model instance',
        content: {'application/json': {schema: getModelSchemaRef(Comment)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Post.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Comment, {
            title: 'NewCommentInPost',
            exclude: ['id'],
            optional: ['postId'],
          }),
        },
      },
    })
    comment: Omit<Comment, 'id'>,
  ): Promise<Comment> {
    this.metricService.countComment(id) as Promise<void>;

    comment.createdAt = new Date().toString();
    comment.updatedAt = new Date().toString();

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
    @param.query.object('where', getWhereSchemaFor(Comment))
    where?: Where<Comment>,
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
    @param.query.object('where', getWhereSchemaFor(Comment))
    where?: Where<Comment>,
  ): Promise<Count> {
    return this.postRepository.comments(id).delete(where);
  }
}

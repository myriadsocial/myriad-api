import {intercept, service} from '@loopback/core';
import {Count, CountSchema, Filter, repository} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {ReferenceType} from '../enums';
import {
  CreateInterceptor,
  DeleteInterceptor,
  PaginationInterceptor,
  UpdateInterceptor,
} from '../interceptors';
import {Comment} from '../models';
import {CommentRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';
import {UserService} from '../services/user.service';

@authenticate('jwt')
export class CommentController {
  constructor(
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @service(UserService)
    private userService: UserService,
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
    @param.filter(Comment, {exclude: ['limit', 'skip', 'offset', 'where']})
    filter?: Filter<Comment>,
  ): Promise<Comment[]> {
    return this.commentRepository.find(filter);
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
    return this.commentRepository.updateById(id, {
      deletedAt: new Date().toString(),
      deleteByUser: true,
    });
  }

  @get('/comments/action')
  @response(200, {
    description: 'Action COUNT left',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(): Promise<Count | undefined> {
    return this.userService.actionCount();
  }
}

import {authenticate} from '@loopback/authentication';
import {intercept, service} from '@loopback/core';
import {Count, CountSchema, Filter} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {PaginationInterceptor} from '../../interceptors';
import {Comment} from '../../models';
import {UserService} from '../../services';

@authenticate('jwt')
export class UserCommentController {
  constructor(
    @service(UserService)
    private userService: UserService,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/user/comments')
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
    @param.filter(Comment, {exclude: ['limit', 'skip', 'offset', 'where']})
    filter?: Filter<Comment>,
  ): Promise<Comment[]> {
    return this.userService.comments(filter);
  }

  @get('/user/comments/action')
  @response(200, {
    description: 'Action COUNT left',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(): Promise<Count | undefined> {
    return this.userService.actionCount();
  }

  @post('/user/comments')
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
            exclude: ['id', 'deleteByUser'],
          }),
        },
      },
    })
    comment: Omit<Comment, 'id'>,
  ): Promise<Comment> {
    return this.userService.createComment(comment);
  }

  @del('/user/comments/{id}')
  @response(200, {
    description: 'SOFT DELETE user comment',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Comment),
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<Comment> {
    return this.userService.removeComment(id);
  }
}

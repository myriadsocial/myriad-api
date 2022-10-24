import {authenticate} from '@loopback/authentication';
import {intercept, service} from '@loopback/core';
import {Filter} from '@loopback/repository';
import {
  get,
  getModelSchemaRef,
  param,
  patch,
  requestBody,
  response,
} from '@loopback/rest';
import {
  FindByIdInterceptor,
  PaginationInterceptor,
  UpdateInterceptor,
} from '../../interceptors';
import {ActivityLog, UpdateUserDto, User} from '../../models';
import {UserService} from '../../services';

@authenticate('jwt')
export class UserController {
  constructor(
    @service(UserService)
    private userService: UserService,
  ) {}

  @intercept(FindByIdInterceptor.BINDING_KEY)
  @get('/current-user')
  @response(200, {
    description: 'GET current user',
    content: {
      'application/json': {
        schema: getModelSchemaRef(User, {includeRelations: true}),
      },
    },
  })
  async getCurrentUser(
    @param.filter(User, {exclude: ['limit', 'skip', 'offset', 'where']})
    filter?: Filter<User>,
  ): Promise<User> {
    return this.userService.current(filter);
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/users')
  @response(200, {
    description: 'GET users',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(User, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(User, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<User>,
  ): Promise<User[]> {
    return this.userService.find(filter);
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/user-logs')
  @response(200, {
    description: 'GET user activity-logs',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(ActivityLog, {includeRelations: true}),
        },
      },
    },
  })
  async log(
    @param.filter(ActivityLog, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<ActivityLog>,
  ): Promise<ActivityLog[]> {
    return this.userService.activityLog(filter);
  }

  @intercept(UpdateInterceptor.BINDING_KEY)
  @patch('/profile')
  @response(204, {description: 'UPDATE profile'})
  async updateById(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UpdateUserDto, {
            partial: true,
          }),
        },
      },
    })
    user: Partial<UpdateUserDto>,
  ): Promise<void> {
    return this.userService.updateProfile(user);
  }
}

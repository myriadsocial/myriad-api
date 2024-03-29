import {intercept, service} from '@loopback/core';
import {Filter} from '@loopback/repository';
import {authenticate} from '@loopback/authentication';
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
import {PaginationInterceptor} from '../../interceptors';
import {Friend} from '../../models';
import {UserService} from '../../services';

@authenticate('jwt')
export class UserFriendController {
  constructor(
    @service(UserService)
    private userService: UserService,
  ) {}

  @post('/user/friends')
  @response(200, {
    description: 'Friend model instance',
    content: {'application/json': {schema: getModelSchemaRef(Friend)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Friend, {
            title: 'NewFriend',
            exclude: ['id', 'totalMutual'],
          }),
        },
      },
    })
    friend: Omit<Friend, 'id'>,
  ): Promise<Friend> {
    return this.userService.requestFriend(friend);
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/user/friends')
  @response(200, {
    description: 'Array of Friend model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Friend, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Friend, {exclude: ['limit', 'skip', 'offset', 'where']})
    filter?: Filter<Friend>,
  ): Promise<Friend[]> {
    return this.userService.friends(filter);
  }

  @patch('/user/friends/{id}')
  @response(204, {description: 'RESPOND friend'})
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Friend, {
            partial: true,
          }),
        },
      },
    })
    friend: Partial<Friend>,
  ): Promise<void> {
    await this.userService.respondFriend(id, friend);
  }

  @del('/user/friends/{id}')
  @response(204, {
    description: 'REMOVE friend',
  })
  async deleteById(
    @param.path.string('id') id: string,
    @param.query.object('friend') friend?: Friend,
  ): Promise<void> {
    await this.userService.removeFriend(id, friend);
  }
}

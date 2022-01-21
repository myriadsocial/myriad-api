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
  response,
} from '@loopback/rest';
import {
  AuthorizeInterceptor,
  CreateInterceptor,
  DeleteInterceptor,
  PaginationInterceptor,
  UpdateInterceptor,
} from '../interceptors';
import {Friend, User} from '../models';
import {FriendRepository, UserRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
@intercept(AuthorizeInterceptor.BINDING_KEY)
export class FriendController {
  constructor(
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
  ) {}

  @intercept(CreateInterceptor.BINDING_KEY)
  @post('/friends')
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
    return this.friendRepository.create(friend);
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/friends')
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
    @param.filter(Friend, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<Friend>,
  ): Promise<Friend[]> {
    return this.friendRepository.find(filter);
  }

  @get('/friends/{id}')
  @response(200, {
    description: 'Friend model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Friend, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Friend, {exclude: 'where'})
    filter?: FilterExcludingWhere<Friend>,
  ): Promise<Friend> {
    return this.friendRepository.findById(id, filter);
  }

  @intercept(UpdateInterceptor.BINDING_KEY)
  @patch('/friends/{id}')
  @response(204, {
    description: 'Friend PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Friend, {
            partial: true,
            exclude: [
              'id',
              'createdAt',
              'updatedAt',
              'deletedAt',
              'requesteeId',
              'requestorId',
              'totalMutual',
            ],
          }),
        },
      },
    })
    friend: Partial<Friend>,
  ): Promise<void> {
    await this.friendRepository.updateById(id, friend);
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/friends/{requestorId}/detail/{requesteeId}')
  @response(200, {
    description: 'Array of Detail Mutual User model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(User, {includeRelations: true}),
        },
      },
    },
  })
  async mutualDetail(
    @param.filter(User, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<User>,
  ): Promise<User[]> {
    return this.userRepository.find(filter);
  }

  @intercept(DeleteInterceptor.BINDING_KEY)
  @del('/friends/{id}')
  @response(204, {
    description: 'Friend DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.friendRepository.deleteById(id);
  }
}

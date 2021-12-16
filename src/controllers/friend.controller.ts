import {intercept} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
} from '@loopback/repository';
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
import {FriendStatusType} from '../enums';
import {PaginationInterceptor} from '../interceptors';
import {ValidateFriendRequestInterceptor} from '../interceptors/validate-friend-request.interceptor';
import {Friend, User} from '../models';
import {FriendRepository, UserRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
export class FriendController {
  constructor(
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
  ) {}

  @intercept(ValidateFriendRequestInterceptor.BINDING_KEY)
  @post('/friends')
  @response(200, {
    description: 'Friend model instance',
    content: {'application/json': {schema: getModelSchemaRef(Friend)}},
  })
  async add(
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

  @intercept(ValidateFriendRequestInterceptor.BINDING_KEY)
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

  @get('/friends/{requestorId}/mutual/{requesteeId}')
  @response(200, {
    description: 'Count mutual friends',
    content: {
      'application/json': {
        schema: CountSchema,
      },
    },
  })
  async mutualCount(
    @param.path.string('requestorId') requestorId: string,
    @param.path.string('requesteeId') requesteeId: string,
  ): Promise<Count> {
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    const collection = (
      this.friendRepository.dataSource.connector as any
    ).collection(Friend.modelName);

    const countMutual = await collection
      .aggregate([
        {
          $match: {
            $or: [
              {
                requestorId: requestorId,
                status: FriendStatusType.APPROVED,
              },
              {
                requestorId: requesteeId,
                status: FriendStatusType.APPROVED,
              },
            ],
          },
        },
        {$group: {_id: '$requesteeId', count: {$sum: 1}}},
        {$match: {count: 2}},
        {$group: {_id: null, count: {$sum: 1}}},
        {$project: {_id: 0}},
      ])
      .get();

    if (countMutual.length === 0) return {count: 0};
    return countMutual[0];
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

  @intercept(ValidateFriendRequestInterceptor.BINDING_KEY)
  @del('/friends/{id}')
  @response(204, {
    description: 'Friend DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.friendRepository.deleteById(id);
  }
}

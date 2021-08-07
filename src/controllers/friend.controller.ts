import {intercept, service} from '@loopback/core';
import {Filter, FilterExcludingWhere} from '@loopback/repository';
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
import {CustomFilter, Friend} from '../models';
import {FriendService, NotificationService} from '../services';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class FriendController {
  constructor(
    @service(NotificationService)
    protected notificationService: NotificationService,
    @service(FriendService)
    protected friendService: FriendService,
  ) {}

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
            exclude: ['id'],
          }),
        },
      },
    })
    friend: Omit<Friend, 'id'>,
  ): Promise<Friend> {
    const foundFriend = await this.friendService.findFriend(friend.friendId, friend.requestorId);

    if (foundFriend) return foundFriend;

    try {
      await this.notificationService.sendFriendRequest(friend.requestorId, friend.friendId);
    } catch (error) {
      // ignored
    }

    return this.friendService.friendRepository.create(friend);
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
    @param.query.object('filter', getModelSchemaRef(CustomFilter)) filter: CustomFilter,
  ): Promise<Friend[]> {
    return this.friendService.friendRepository.find(filter as Filter<Friend>);
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
    return this.friendService.friendRepository.findById(id, filter);
  }

  @patch('/friends/{id}')
  @response(204, {
    description: 'Friend PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Friend, {partial: true}),
        },
      },
    })
    friend: Friend,
  ): Promise<void> {
    if (friend.status === FriendStatusType.APPROVED) {
      try {
        await this.notificationService.sendFriendAccept(friend.friendId, friend.requestorId);
      } catch (error) {
        // ignored
      }
    }
    await this.friendService.friendRepository.updateById(id, friend);
  }

  @del('/friends/{id}')
  @response(204, {
    description: 'Friend DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.friendService.deleteById(id);
  }
}

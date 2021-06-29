import {service} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  HttpErrors,
  param,
  patch,
  post,
  requestBody,
  response
} from '@loopback/rest';
import {Friend} from '../models';
import {FriendRepository} from '../repositories';
import {NotificationService} from '../services';
import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class FriendController {
  constructor(
    @repository(FriendRepository)
    public friendRepository: FriendRepository,
    @service(NotificationService)
    public notificationService: NotificationService,
  ) { }

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
    if (friend.requestorId === friend.friendId) {
      throw new HttpErrors.UnprocessableEntity('Cannot add itself')
    }

    const countFriend = await this.friendRepository.count({
      friendId: friend.friendId,
      requestorId: friend.requestorId,
      status: 'pending'
    })

    if (countFriend.count > 20) {
      throw new HttpErrors.UnprocessableEntity("Please approved your pending request, before add new friend! Maximum pending request: 20")
    }

    const foundFriend = await this.friendRepository.findOne({
      where: {
        friendId: friend.friendId,
        requestorId: friend.requestorId
      }
    })

    if (foundFriend && foundFriend.status === 'rejected') {
      this.friendRepository.updateById(foundFriend.id, {
        status: "pending",
        updatedAt: new Date().toString()
      })

      foundFriend.status = 'pending'
      foundFriend.updatedAt = new Date().toString()

      return foundFriend
    }

    if (foundFriend && foundFriend.status === 'approved') {
      throw new HttpErrors.UnprocessableEntity('You already friend with this user')
    }

    if (foundFriend && foundFriend.status === 'pending') {
      throw new HttpErrors.UnprocessableEntity('Please wait for this user to approved your request')
    }

    const result = await this.friendRepository.create(friend)

    try {
      await this.notificationService.sendFriendRequest(friend.requestorId, friend.friendId);
    } catch (error) {
      // ignored
    }

    return result
  }

  @get('/friends/count')
  @response(200, {
    description: 'Friend model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Friend) where?: Where<Friend>,
  ): Promise<Count> {
    return this.friendRepository.count(where);
  }

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
    @param.filter(Friend) filter?: Filter<Friend>,
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
    @param.filter(Friend, {exclude: 'where'}) filter?: FilterExcludingWhere<Friend>
  ): Promise<Friend> {
    return this.friendRepository.findById(id, filter);
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
    if (friend.status === 'approved') {
      try {
        await this.notificationService.sendFriendAccept(friend.friendId, friend.requestorId);
      } catch (error) {
        // ignored
      }
    }
    await this.friendRepository.updateById(id, friend);
  }

  @del('/friends/{id}')
  @response(204, {
    description: 'Friend DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.friendRepository.deleteById(id);
  }
}

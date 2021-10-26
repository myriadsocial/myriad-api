import {intercept, service} from '@loopback/core';
import {Filter, FilterExcludingWhere} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  HttpErrors,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {FriendStatusType} from '../enums';
import {PaginationInterceptor} from '../interceptors';
import {ValidateFriendRequestInterceptor} from '../interceptors/validate-friend-request.interceptor';
import {Friend} from '../models';
import {FriendService, MetricService, NotificationService} from '../services';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class FriendController {
  constructor(
    @service(NotificationService)
    protected notificationService: NotificationService,
    @service(FriendService)
    protected friendService: FriendService,
    @service(MetricService)
    protected metricService: MetricService,
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
            exclude: ['id'],
          }),
        },
      },
    })
    friend: Omit<Friend, 'id'>,
  ): Promise<Friend> {
    try {
      await this.notificationService.sendFriendRequest(
        friend.requestorId,
        friend.requesteeId,
      );
    } catch (error) {
      // ignored
    }

    return this.friendService.friendRepository.create(friend);
  }

  @post('/friends/blocked')
  @response(200, {
    description: 'Blocked friend',
    content: {'application/json': {schema: getModelSchemaRef(Friend)}},
  })
  async blocked(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Friend, {
            title: 'NewFriend',
            exclude: ['id', 'status', 'createdAt', 'updatedAt', 'deletedAt'],
          }),
        },
      },
    })
    friend: Omit<Friend, 'id'>,
  ): Promise<Friend> {
    const found = await this.friendService.friendRepository.findOne({
      where: {
        or: [
          {
            requestorId: friend.requestorId,
            requesteeId: friend.requesteeId,
          },
          {
            requesteeId: friend.requestorId,
            requestorId: friend.requesteeId,
          },
        ],
      },
    });

    if (found) {
      if (found.status === FriendStatusType.BLOCKED) {
        throw new HttpErrors.UnprocessableEntity(
          'You already blocked this friends',
        );
      } else {
        await this.friendService.friendRepository.deleteById(found.id);
      }
    }

    friend.status = FriendStatusType.BLOCKED;

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
    @param.filter(Friend, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<Friend>,
  ): Promise<Friend[]> {
    return this.friendService.friendRepository.find(filter);
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/friends/blocked')
  @response(200, {
    description: 'Array of Blocked Friend model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Friend, {includeRelations: true}),
        },
      },
    },
  })
  async findBlockedFriend(
    @param.filter(Friend, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<Friend>,
  ): Promise<Friend[]> {
    return this.friendService.friendRepository.find(filter);
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
          schema: getModelSchemaRef(Friend, {
            partial: true,
            exclude: ['id'],
          }),
        },
      },
    })
    friend: Partial<Friend>,
  ): Promise<void> {
    await this.friendService.friendRepository.updateById(id, friend);

    if (friend.status === FriendStatusType.APPROVED) {
      try {
        const {requestee, requestor} =
          await this.friendService.friendRepository.findById(id, {
            include: ['requestee', 'requestor'],
          });

        if (requestee && requestor) {
          await this.notificationService.sendFriendAccept(requestee, requestor);
          await this.metricService.userMetric(requestee.id);
          await this.metricService.userMetric(requestor.id);
        }
      } catch (error) {
        // ignored
      }
    }
  }

  @del('/friends/{id}')
  @response(204, {
    description: 'Friend DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.friendService.deleteById(id);
  }
}

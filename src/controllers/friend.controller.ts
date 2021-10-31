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
      if (friend.status === FriendStatusType.PENDING) {
        await this.notificationService.sendFriendRequest(
          friend.requestorId,
          friend.requesteeId,
        );
      }
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
            exclude: [
              'id',
              'createdAt',
              'updatedAt',
              'deletedAt',
              'requesteeId',
              'requestorId',
            ],
          }),
        },
      },
    })
    friend: Partial<Friend>,
  ): Promise<void> {
    if (friend.status === FriendStatusType.BLOCKED) {
      const found = await this.friendService.friendRepository.findById(id);

      if (found.requesteeId === this.friendService.myriadOfficialUserId()) {
        throw new HttpErrors.UnprocessableEntity(
          'You cannot blocked this user!',
        );
      }
    }

    await this.friendService.friendRepository.updateById(id, friend);

    const {requestee, requestor} = await this.friendService.friendRepository.findById(id, {
      include: ['requestee', 'requestor'],
    });

    if (requestee && requestor) {
      await this.friendService.friendRepository.create({
        requesteeId: requestor.id,
        requestorId: requestee.id,
        status: FriendStatusType.APPROVED,
      });

      await this.metricService.userMetric(requestee.id);
      await this.metricService.userMetric(requestor.id);

      try {
        await this.notificationService.sendFriendAccept(requestee, requestor);
      } catch {
        // ignored
      }
    } else {
      throw new HttpErrors.UnprocessableEntity('Wrong requesteeId/requestorId');
    }
  }

  @del('/friends/{id}')
  @response(204, {
    description: 'Friend DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    const friend = await this.friendService.friendRepository.findById(id);

    await this.notificationService.cancelFriendRequest(
      friend.requestorId,
      friend.requesteeId,
    );

    await this.friendService.friendRepository.deleteAll({
      or: [
        {
          requesteeId: friend.requesteeId,
          requestorId: friend.requestorId,
        },
        {
          requestorId: friend.requesteeId,
          requesteeId: friend.requestorId,
        },
      ],
    });

    await this.metricService.userMetric(friend.requesteeId);
    await this.metricService.userMetric(friend.requestorId);
  }
}

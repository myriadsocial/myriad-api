import {BindingScope, injectable, service} from '@loopback/core';
import {AnyObject, Count, Filter, repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {omit, pull, union} from 'lodash';
import {
  AccountSettingType,
  ActivityLogType,
  FriendStatusType,
  ReferenceType,
} from '../enums';
import {Friend, FriendWithRelations} from '../models';
import {
  AccountSettingRepository,
  FriendRepository,
  UserRepository,
} from '../repositories';
import {ActivityLogService} from './activity-log.service';
import {MetricService} from './metric.service';
import {NotificationService} from './notification.service';

@injectable({scope: BindingScope.TRANSIENT})
export class FriendService {
  constructor(
    @repository(AccountSettingRepository)
    private accountSettingRepository: AccountSettingRepository,
    @repository(FriendRepository)
    private friendRepository: FriendRepository,
    @repository(UserRepository)
    private userRepository: UserRepository,
    @service(ActivityLogService)
    private activityLogService: ActivityLogService,
    @service(MetricService)
    private metricService: MetricService,
    @service(NotificationService)
    private notificationService: NotificationService,
  ) {}

  public collection() {
    const collection = this.friendRepository.dataSource.connector?.collection(
      Friend.modelName,
    );

    if (!collection) {
      throw new HttpErrors.NotFound('CollectionNotFound');
    }

    return collection;
  }

  public async find(filter?: Filter<Friend>): Promise<Friend[]> {
    return this.friendRepository.find(filter);
  }

  public async findOne(filter?: Filter<Friend>): Promise<Friend | null> {
    return this.friendRepository.findOne(filter);
  }

  public async remove(id: string, friend?: Friend): Promise<void> {
    const jobs: Promise<Count | void>[] = [
      this.friendRepository.deleteById(id),
    ];

    if (friend) {
      const {requesteeId, requestorId} = friend;

      jobs.unshift(
        this.friendRepository.deleteAll({
          requestorId: requesteeId,
          requesteeId: requestorId,
        }),
      );
    }

    return Promise.all(jobs).then(() => this.afterDelete(friend));
  }

  public async request(friend: Omit<Friend, 'id'>): Promise<Friend> {
    return this.beforeRequest(friend)
      .then(() => this.friendRepository.create(friend))
      .then(created => this.afterRequest(created))
      .catch(err => {
        throw err;
      });
  }

  public async respond(id: string, data: Friend): Promise<void> {
    if (data.status !== FriendStatusType.PENDING) {
      throw new HttpErrors.UnprocessableEntity('RespondFailed');
    }

    return this.validateRespond(data)
      .then(friend => this.friendRepository.updateById(id, friend))
      .then(() => this.afterRespond(data))
      .catch(err => {
        throw err;
      });
  }

  // ------------------------------------------------

  // ------ PublicMethod ----------------------------

  async getFriendIds(
    id: string,
    status: FriendStatusType,
    skipPrivateAccont = false,
  ): Promise<string[]> {
    const filter = {
      where: {
        or: [
          {
            requestorId: id,
            status: status,
          },
          {
            requesteeId: id,
            status: status,
          },
        ],
      },
    } as Filter<Friend>;

    let privateIds: string[] = [];

    if (status === FriendStatusType.BLOCKED && !skipPrivateAccont) {
      const accountSetting = await this.accountSettingRepository.find({
        where: {accountPrivacy: AccountSettingType.PRIVATE},
      });

      privateIds = accountSetting.map(setting => setting.userId);
    }

    const friends = await this.friendRepository.find(filter);
    const requesteeIds = friends.map(friend => friend.requesteeId);
    const requestorIds = friends.map(friend => friend.requestorId);

    const friendIds = union(requesteeIds, requestorIds, privateIds);
    return pull(friendIds, id);
  }

  async removedFriend(friend: Friend): Promise<AnyObject> {
    const {requesteeId, requestorId} = friend;

    await this.friendRepository.deleteAll({
      requestorId: requesteeId,
      requesteeId: requestorId,
    });

    return {
      requesteeId: requesteeId,
      requestorId: requestorId,
    };
  }

  async countMutual(requestorId: string, requesteeId: string): Promise<Count> {
    const collection = (
      this.friendRepository.dataSource.connector as AnyObject
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

  async asFriend(requestorId: string, requesteeId: string): Promise<boolean> {
    const friend = await this.friendRepository.findOne(<AnyObject>{
      where: {
        or: [
          {
            requesteeId: requesteeId,
            requestorId: requestorId,
            status: FriendStatusType.APPROVED,
            deletedAt: {
              $eq: null,
            },
          },
          {
            requestorId: requesteeId,
            requesteeId: requestorId,
            status: FriendStatusType.APPROVED,
            deletedAt: {
              $eq: null,
            },
          },
        ],
      },
    });

    return Boolean(friend);
  }

  async getFriendInfo(currentUser: string, requesteeId: string) {
    let friendId = null;
    let friendStatus = null;

    const friend = await this.friendRepository.findOne({
      where: {
        or: [
          {
            requesteeId,
            requestorId: currentUser,
          },
          {
            requestorId: requesteeId,
            requesteeId: currentUser,
          },
        ],
      },
    });

    if (!friend) return;

    friendId = friend.id;

    switch (friend.status) {
      case FriendStatusType.APPROVED:
        friendStatus = 'friends';
        break;

      case FriendStatusType.PENDING:
        if (currentUser === friend.requestorId) {
          friendStatus = 'requested';
        } else {
          friendStatus = 'respond';
        }
        break;

      default:
        friendStatus = 'blocked';
    }

    return {
      id: friendId,
      status: friendStatus,
      requesteeId: friend.requesteeId,
      requestorId: friend.requestor,
    };
  }

  // ------------------------------------------------

  // ------ PrivateMethod ---------------------------

  private async beforeRequest(friend: Omit<Friend, 'id'>): Promise<void> {
    const {requestorId, requesteeId, status} = friend;

    switch (status) {
      case FriendStatusType.PENDING: {
        return this.validatePendingRequest(requesteeId, requestorId);
      }

      case FriendStatusType.BLOCKED: {
        return this.validateBlockRequest(requesteeId, requestorId);
      }

      case FriendStatusType.APPROVED: {
        throw new HttpErrors.UnprocessableEntity('RequestFailed');
      }
    }
  }

  private async afterRequest(friend: Friend): Promise<Friend> {
    if (friend && friend.status === FriendStatusType.PENDING) {
      Promise.allSettled([
        this.notificationService.sendFriendRequest(friend.requesteeId),
        this.activityLogService.create(
          ActivityLogType.FRIENDREQUEST,
          friend.requesteeId,
          ReferenceType.USER,
        ),
      ]) as Promise<AnyObject>;
    }

    if (friend && friend.status === FriendStatusType.BLOCKED) {
      const {requesteeId, requestorId} = friend as Friend;

      Promise.allSettled([
        this.userRepository
          .findById(requestorId)
          .then(({friendIndex: requestorFriendIndex}) => {
            return this.userRepository.updateById(requestorId, {
              friendIndex: omit(requestorFriendIndex, [requesteeId]),
            });
          }),
        this.userRepository
          .findById(requesteeId)
          .then(({friendIndex: requesteeFriendIndex}) => {
            return this.userRepository.updateById(requesteeId, {
              friendIndex: omit(requesteeFriendIndex, [requestorId]),
            });
          }),
      ]) as Promise<AnyObject>;
    }

    return friend;
  }

  private async afterRespond(friend: FriendWithRelations): Promise<void> {
    const {requestor, requestee} = friend;
    if (!requestor || !requestee) return;
    const {friendIndex: requestorFriendIndex} = requestor;
    const {friendIndex: requesteeFriendIndex} = requestee;

    Promise.allSettled([
      this.notificationService.sendFriendAccept(requestor.id),
      this.metricService.userMetric(requestor.id),
      this.metricService.userMetric(requestee.id),
      this.userRepository.updateById(requestor.id, {
        friendIndex: {
          ...requestorFriendIndex,
          [requestee.id]: 1,
        },
      }),
      this.userRepository.updateById(requestee.id, {
        friendIndex: {
          ...requesteeFriendIndex,
          [requestor.id]: 1,
        },
      }),
    ]) as Promise<AnyObject>;
  }

  private async afterDelete(friend?: FriendWithRelations): Promise<void> {
    if (!friend) return;
    const {requesteeId, requestorId, requestee, requestor} = friend;
    if (!requestor || !requestee) return;
    const {friendIndex: requestorFriendIndex} = requestor;
    const {friendIndex: requesteeFriendIndex} = requestee;

    Promise.allSettled([
      this.metricService.userMetric(requesteeId),
      this.metricService.userMetric(requestorId),
      this.userRepository.updateById(requestorId, {
        friendIndex: omit(requestorFriendIndex, [requesteeId]),
      }),
      this.userRepository.updateById(requesteeId, {
        friendIndex: omit(requesteeFriendIndex, [requestorId]),
      }),
      this.notificationService.cancelFriendRequest(requestorId, requesteeId),
    ]) as Promise<AnyObject>;
  }

  private async validateRespond(
    friend: FriendWithRelations,
  ): Promise<Partial<Friend>> {
    const {requestee, requestor, status} = friend;

    if (requestee && requestor) {
      if (status === FriendStatusType.APPROVED) {
        throw new HttpErrors.UnprocessableEntity('AlreadyFriend');
      }

      await this.friendRepository.create({
        requesteeId: requestor.id,
        requestorId: requestee.id,
        status: FriendStatusType.APPROVED,
      });

      return {status: FriendStatusType.APPROVED};
    } else {
      throw new HttpErrors.UnprocessableEntity('WrongRequesteeId/RequestorId');
    }
  }

  private async validatePendingRequest(
    requesteeId: string,
    requestorId: string,
  ): Promise<void> {
    if (requesteeId === requestorId) {
      throw new HttpErrors.UnprocessableEntity('FailedRequest');
    }

    let friend = await this.findOne({
      where: {
        requesteeId: requesteeId,
        requestorId: requestorId,
      },
    });

    if (friend) {
      switch (friend.status) {
        case FriendStatusType.APPROVED: {
          throw new HttpErrors.UnprocessableEntity('AlreadyFriend');
        }

        case FriendStatusType.PENDING: {
          throw new HttpErrors.UnprocessableEntity('Inprogress');
        }

        case FriendStatusType.BLOCKED: {
          throw new HttpErrors.UnprocessableEntity('RequestBlocked');
        }
      }
    } else {
      friend = await this.findOne({
        where: {
          requestorId: requesteeId,
          requesteeId: requestorId,
        },
      });
    }

    if (friend) {
      switch (friend.status) {
        case FriendStatusType.PENDING: {
          throw new HttpErrors.UnprocessableEntity('WaitingForRespond');
        }

        case FriendStatusType.BLOCKED: {
          throw new HttpErrors.UnprocessableEntity('Blocked');
        }
      }
    }
  }

  private async validateBlockRequest(
    requesteeId: string,
    requestorId: string,
  ): Promise<void> {
    if (requesteeId === requestorId) {
      throw new HttpErrors.UnprocessableEntity('FailedToRequest');
    }

    const found = await this.findOne({
      where: {
        or: [
          {
            requestorId: requestorId,
            requesteeId: requesteeId,
          },
          {
            requestorId: requesteeId,
            requesteeId: requestorId,
          },
        ],
      },
    });

    if (found) {
      if (found.status === FriendStatusType.BLOCKED) {
        throw new HttpErrors.UnprocessableEntity('RequestBlocked');
      } else {
        await this.friendRepository.deleteAll({
          or: [
            {
              requestorId: requestorId,
              requesteeId: requesteeId,
            },
            {
              requestorId: requesteeId,
              requesteeId: requestorId,
            },
          ],
        });
      }
    }
  }
}

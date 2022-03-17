import {AnyObject, Count, repository, Where} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {AccountSettingType, FriendStatusType, VisibilityType} from '../enums';
import {Friend, FriendWithRelations, Post} from '../models';
import {
  AccountSettingRepository,
  FriendRepository,
  WalletRepository,
} from '../repositories';
import {injectable, BindingScope} from '@loopback/core';
import {Filter} from '@loopback/repository';
import {config} from '../config';
import _ from 'lodash';

@injectable({scope: BindingScope.TRANSIENT})
export class FriendService {
  constructor(
    @repository(AccountSettingRepository)
    protected accountSettingRepository: AccountSettingRepository,
    @repository(FriendRepository)
    public friendRepository: FriendRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
  ) {}

  async validatePendingFriendRequest(
    requesteeId: string,
    requestorId: string,
  ): Promise<void> {
    if (requesteeId === requestorId) {
      throw new HttpErrors.UnprocessableEntity(
        'You cannot request to yourself!',
      );
    }

    let friend = await this.friendRepository.findOne({
      where: {
        requesteeId: requesteeId,
        requestorId: requestorId,
      },
    });

    if (friend) {
      switch (friend.status) {
        case FriendStatusType.APPROVED: {
          throw new HttpErrors.UnprocessableEntity(
            'You already friend with this user',
          );
        }

        case FriendStatusType.PENDING: {
          throw new HttpErrors.UnprocessableEntity(
            "Please wait for your friend's approval!",
          );
        }

        case FriendStatusType.BLOCKED: {
          throw new HttpErrors.UnprocessableEntity(
            'You have blocked this user!',
          );
        }
      }
    } else {
      friend = await this.friendRepository.findOne({
        where: {
          requestorId: requesteeId,
          requesteeId: requestorId,
        },
      });
    }

    if (friend) {
      switch (friend.status) {
        case FriendStatusType.PENDING: {
          throw new HttpErrors.UnprocessableEntity(
            'Please approved your friend request!',
          );
        }

        case FriendStatusType.BLOCKED: {
          throw new HttpErrors.UnprocessableEntity(
            'You have been blocked by this user!',
          );
        }
      }
    }
  }

  async validateBlockFriendRequest(
    requesteeId: string,
    requestorId: string,
  ): Promise<void> {
    if (requesteeId === requestorId) {
      throw new HttpErrors.UnprocessableEntity(
        'You cannot request to yourself!',
      );
    }

    const myriadUserId = await this.getMyriadUserId();
    if (requesteeId === myriadUserId) {
      throw new HttpErrors.UnprocessableEntity(
        'You cannot blocked myriad official',
      );
    }

    const found = await this.friendRepository.findOne({
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
        throw new HttpErrors.UnprocessableEntity(
          'You already blocked/has been blocked by another user!',
        );
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

  async validateApproveFriendRequest(
    friend: FriendWithRelations,
  ): Promise<AnyObject> {
    const {requestee, requestor, status} = friend;

    if (requestee && requestor) {
      if (status === FriendStatusType.APPROVED) {
        throw new HttpErrors.UnprocessableEntity(
          'You already friends with the user',
        );
      }

      const myriadUserId = await this.getMyriadUserId();
      if (requestor.id !== myriadUserId) {
        await this.friendRepository.create({
          requesteeId: requestor.id,
          requestorId: requestee.id,
          status: FriendStatusType.APPROVED,
        });
      }

      return {
        requesteeId: requestee.id,
        requestorId: requestor.id,
      };
    } else {
      throw new HttpErrors.UnprocessableEntity('Wrong requesteeId/requestorId');
    }
  }

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

    const friendIds = _.union(requesteeIds, requestorIds, privateIds);
    return _.pull(friendIds, id);
  }

  async friendsTimeline(userId: string): Promise<Where<Post> | undefined> {
    const approvedFriendIds = await this.getFriendIds(
      userId,
      FriendStatusType.APPROVED,
    );

    if (!approvedFriendIds.length) return;

    return {
      createdBy: {inq: approvedFriendIds},
      visibility: {nlike: VisibilityType.PRIVATE},
    } as Where<Post>;
  }

  async defaultFriend(userId: string): Promise<void> {
    const myriadUserId = await this.getMyriadUserId();
    await this.friendRepository.create({
      status: FriendStatusType.APPROVED,
      requestorId: userId,
      requesteeId: myriadUserId,
    });
  }

  async removedFriend(friend: Friend): Promise<AnyObject> {
    const {requesteeId, requestorId} = friend;
    const myriadUserId = await this.getMyriadUserId();
    if (requesteeId === myriadUserId) {
      throw new HttpErrors.UnprocessableEntity('You cannot removed this user!');
    }

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

  async handlePendingBlockedRequest(friend: Friend): Promise<void> {
    const {requestorId, requesteeId, status} = friend;

    switch (status) {
      case FriendStatusType.PENDING: {
        return this.validatePendingFriendRequest(requesteeId, requestorId);
      }

      case FriendStatusType.BLOCKED: {
        return this.validateBlockFriendRequest(requesteeId, requestorId);
      }

      case FriendStatusType.APPROVED: {
        throw new HttpErrors.UnprocessableEntity(
          'Please set status to pending or blocked',
        );
      }
    }
  }

  async getMutualUserIds(
    requestorId: string,
    requesteeId: string,
  ): Promise<string[]> {
    const collection = (
      this.friendRepository.dataSource.connector as AnyObject
    ).collection(Friend.modelName);

    return (
      await collection
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
          {$project: {_id: 1}},
        ])
        .get()
    ).map((user: AnyObject) => user._id);
  }

  async getMyriadUserId(): Promise<string> {
    const publicAddress = config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY;
    const wallet = await this.walletRepository.findById(publicAddress);
    return wallet.userId;
  }
}

import {AnyObject, repository, Where} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {FriendStatusType, VisibilityType} from '../enums';
import {Friend, Post} from '../models';
import {FriendRepository, UserRepository} from '../repositories';
import {injectable, BindingScope} from '@loopback/core';
import {PolkadotJs} from '../utils/polkadotJs-utils';
import {Filter} from '@loopback/repository';
import {config} from '../config';

@injectable({scope: BindingScope.TRANSIENT})
export class FriendService {
  constructor(
    @repository(FriendRepository)
    public friendRepository: FriendRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
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
    requestorId: string,
    requesteeId: string,
  ): Promise<void> {
    if (requesteeId === requestorId) {
      throw new HttpErrors.UnprocessableEntity(
        'You cannot request to yourself!',
      );
    }

    if (requesteeId === this.myriadOfficialUserId()) {
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

  async validateApproveFriendRequest(friendId: string): Promise<AnyObject> {
    const {requestee, requestor, status} = await this.friendRepository.findById(
      friendId,
      {
        include: ['requestee', 'requestor'],
      },
    );

    if (requestee && requestor) {
      if (status === FriendStatusType.APPROVED) {
        throw new HttpErrors.UnprocessableEntity(
          'You already friends with the user',
        );
      }

      if (requestor.id !== this.myriadOfficialUserId()) {
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

  async getFriendIds(id: string, status: FriendStatusType): Promise<string[]> {
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

    const friends = await this.friendRepository.find(filter);
    const requesteeIds = friends.map(friend => friend.requesteeId);
    const requestorIds = friends.map(friend => friend.requestorId);

    const friendIds = [...new Set([...requesteeIds, ...requestorIds])].filter(
      userId => userId !== id,
    );

    return friendIds;
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
    await this.friendRepository.create({
      status: FriendStatusType.APPROVED,
      requestorId: userId,
      requesteeId: this.myriadOfficialUserId(),
    });
  }

  myriadOfficialUserId(): string {
    const {getKeyring, getHexPublicKey} = new PolkadotJs();

    const mnemonic = config.MYRIAD_MNEMONIC;
    const pair = getKeyring().addFromMnemonic(mnemonic);

    return getHexPublicKey(pair);
  }

  async getImporterIds(userId?: string): Promise<string[]> {
    if (!userId) return [];

    const friends = await this.friendRepository.find({
      where: {
        requestorId: userId.toString(),
        status: FriendStatusType.APPROVED,
      },
      limit: 5,
      order: ['updatedAt DESC'],
    });

    if (friends.length > 0) {
      const friendIds = friends.map(friend => friend.requesteeId);

      return [...friendIds, userId];
    }

    return [];
  }

  async removedFriend(friendId: string): Promise<AnyObject> {
    const {requesteeId, requestorId} = await this.friendRepository.findById(
      friendId,
    );

    if (requesteeId === this.myriadOfficialUserId()) {
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
}

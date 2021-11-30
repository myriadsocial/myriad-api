import {service} from '@loopback/core';
import {repository, Where} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {FriendStatusType, VisibilityType} from '../enums';
import {Post} from '../models';
import {FriendRepository, UserRepository} from '../repositories';
import {NotificationService} from './notification.service';
import {injectable, BindingScope} from '@loopback/core';
import {PolkadotJs} from '../utils/polkadotJs-utils';
import {config} from '../config';

@injectable({scope: BindingScope.TRANSIENT})
export class FriendService {
  constructor(
    @repository(FriendRepository)
    public friendRepository: FriendRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @service(NotificationService)
    public notificationService: NotificationService,
  ) {}

  async validateFriendRequest(
    requesteeId: string,
    requestorId: string,
  ): Promise<void> {
    if (requesteeId === requestorId) {
      throw new HttpErrors.UnprocessableEntity('Cannot add itself');
    }

    const friend = await this.friendRepository.findOne({
      where: {
        or: [
          {
            requesteeId: requesteeId,
            requestorId: requestorId,
          },
          {
            requesteeId: requestorId,
            requestorId: requesteeId,
          },
        ],
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
          if (requestorId === friend.requestorId)
            throw new HttpErrors.UnprocessableEntity(
              "Please wait for your friend's approval!",
            );

          throw new HttpErrors.UnprocessableEntity(
            'Your friend waited for your approval!',
          );
        }

        case FriendStatusType.BLOCKED: {
          throw new HttpErrors.UnprocessableEntity(
            'You have blocked this user!',
          );
        }
      }
    }
  }

  async getFriendIds(id: string, status: FriendStatusType): Promise<string[]> {
    const friends = await this.friendRepository.find({
      where: {
        or: [
          {
            requestorId: id,
          },
          {
            requesteeId: id,
          },
        ],
        status: status,
      },
    });

    const friendIds = friends.map(friend => friend.requesteeId);
    const requestorIds = friends.map(friend => friend.requestorId);

    const ids = [...new Set(...friendIds, ...requestorIds)].filter(
      userId => userId !== id,
    );

    return ids;
  }

  async friendsTimeline(userId: string): Promise<Where<Post> | undefined> {
    const approvedFriendIds = await this.getFriendIds(
      userId,
      FriendStatusType.APPROVED,
    );

    if (!approvedFriendIds.length) return;

    return {
      and: [
        {
          or: [
            {
              createdBy: {
                inq: approvedFriendIds,
              },
            },
          ],
        },
        {
          or: [
            {
              visibility: VisibilityType.FRIEND,
            },
            {
              visibility: VisibilityType.PUBLIC,
            },
          ],
        },
      ],
    } as Where<Post>;
  }

  async deleteById(id: string): Promise<void> {
    const friend = await this.friendRepository.findById(id);

    if (friend.requesteeId === this.myriadOfficialUserId()) {
      throw new HttpErrors.UnprocessableEntity('You cannot removed this user!');
    }

    await this.notificationService.cancelFriendRequest(
      friend.requestorId,
      friend.requesteeId,
    );
    await this.friendRepository.deleteById(id);
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
        or: [
          {
            requesteeId: userId.toString(),
          },
          {
            requestorId: userId.toString(),
          },
        ],
      },
      limit: 5,
      order: ['updatedAt DESC'],
    });

    if (friends.length > 0) {
      const requesteeIds = friends.map(friend => friend.requesteeId);
      const requestorIds = friends.map(friend => friend.requestorId);
      const friendIds = [...requesteeIds, ...requestorIds];

      return [...new Set(friendIds)];
    }

    return [userId];
  }
}

import {service} from '@loopback/core';
import {repository, Where} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {FriendStatusType} from '../enums';
import {Post} from '../models';
import {FriendRepository, UserRepository} from '../repositories';
import {NotificationService} from './notification.service';

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

    const pendingFriend = await this.friendRepository.count({
      requestorId: requestorId,
      status: FriendStatusType.PENDING,
    });

    if (pendingFriend.count > 20) {
      throw new HttpErrors.UnprocessableEntity(
        'Please approve current pending request, before add new friend!',
      );
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
            'You cannot added this friend!',
          );
        }
      }
    }
  }

  async getApprovedFriendIds(id: string): Promise<string[]> {
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
        status: FriendStatusType.APPROVED,
      },
    });

    const friendIds = friends.map(friend => friend.requesteeId);
    const requestorIds = friends.map(friend => friend.requestorId);

    const ids = [...friendIds, ...requestorIds].filter(userId => userId !== id);

    return ids;
  }

  async friendsTimeline(userId: string): Promise<Where<Post> | undefined> {
    const approvedFriendIds = await this.getApprovedFriendIds(userId);

    if (!approvedFriendIds.length) return;

    return {
      or: [
        {
          importer: {
            inq: approvedFriendIds,
          },
        },
        {
          createdBy: {
            inq: approvedFriendIds,
          },
        },
      ],
    } as Where<Post>;
  }

  async deleteById(id: string): Promise<void> {
    const friend = await this.friendRepository.findById(id);

    await this.notificationService.cancelFriendRequest(
      friend.requestorId,
      friend.requesteeId,
    );
    await this.friendRepository.deleteById(id);
  }
}

import {service} from '@loopback/core';
import {repository, Where} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {FriendStatusType} from '../enums';
import {Friend, Post} from '../models';
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

  async findFriend(requesteeId: string, requestorId: string): Promise<Friend | null> {
    if (requesteeId === requestorId) {
      throw new HttpErrors.UnprocessableEntity('Cannot add itself');
    }

    const countFriend = await this.friendRepository.count({
      requesteeId: requesteeId,
      requestorId: requestorId,
      status: FriendStatusType.PENDING,
    });

    if (countFriend.count > 20) {
      throw new HttpErrors.UnprocessableEntity(
        'Please approved your pending request, before add new friend!',
      );
    }

    const foundFriend = await this.friendRepository.findOne({
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

    if (foundFriend && foundFriend.status === FriendStatusType.APPROVED) {
      throw new HttpErrors.UnprocessableEntity('You already friend with this user');
    }

    if (foundFriend && foundFriend.status === FriendStatusType.PENDING) {
      throw new HttpErrors.UnprocessableEntity(
        'Please wait for this user to approved your request',
      );
    }

    if (foundFriend && foundFriend.status === FriendStatusType.REJECTED) {
      foundFriend.status = FriendStatusType.PENDING;
      foundFriend.updatedAt = new Date().toString();
      foundFriend.requesteeId = requesteeId;
      foundFriend.requestorId = requestorId;

      this.friendRepository.updateById(foundFriend.id, foundFriend) as Promise<void>;
    }

    return foundFriend;
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

  async filterByFriends(userId: string): Promise<Where<Post> | null> {
    const approvedFriendIds = await this.getApprovedFriendIds(userId);

    if (!approvedFriendIds.length) return null;

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

    if (friend == null) return;

    await this.notificationService.cancelFriendRequest(friend.requestorId, friend.requesteeId);
    await this.friendRepository.deleteById(id);
  }
}

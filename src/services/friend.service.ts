import {service} from '@loopback/core';
import {repository, Where} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {FriendStatusType} from '../enums';
import {Friend} from '../models';
import {FriendRepository, UserRepository} from '../repositories';
import {NotificationService} from './notification.service';

export class FriendService {
  constructor(
    @repository(UserRepository)
    public userRepository: UserRepository,
    @repository(FriendRepository)
    public friendRepository: FriendRepository,
    @service(NotificationService)
    public notificationService: NotificationService,
  ) {}

  async findFriend(friendId: string, requestorId: string): Promise<Friend | null> {
    if (friendId === requestorId) {
      throw new HttpErrors.UnprocessableEntity('Cannot add itself');
    }

    const countFriend = await this.friendRepository.count({
      friendId: friendId,
      requestorId: requestorId,
      status: FriendStatusType.PENDING,
    });

    if (countFriend.count > 20) {
      throw new HttpErrors.UnprocessableEntity(
        'Please approved your pending request, before add new friend!',
      );
    }

    const friend = await this.friendRepository.findOne({
      where: {
        or: [
          {
            friendId: friendId,
            requestorId: requestorId,
          },
          {
            friendId: requestorId,
            requestorId: friendId,
          },
        ],
      },
    });

    if (friend && friend.status === FriendStatusType.APPROVED)
      throw new HttpErrors.UnprocessableEntity('You already friend with this user');

    if (friend && friend.status === FriendStatusType.PENDING)
      throw new HttpErrors.UnprocessableEntity(
        'Please wait for this user to approved your request',
      );

    if (friend && friend.status === FriendStatusType.REJECTED) {
      friend.status = FriendStatusType.PENDING;
      friend.updatedAt = new Date().toString();
      friend.friendId = friendId;
      friend.requestorId = requestorId;

      this.friendRepository.updateById(friend.id, friend) as Promise<void>;
    }

    return friend;
  }

  async getApprovedFriendIds(id: string): Promise<string[]> {
    const friends = await this.friendRepository.find({
      where: {
        or: [
          {
            requestorId: id,
          },
          {
            friendId: id,
          },
        ],
        status: FriendStatusType.APPROVED,
      },
    });

    const friendIds = friends.map(friend => friend.friendId);
    const requestorIds = friends.map(friend => friend.requestorId);

    const ids = [
      ...friendIds.filter(friendId => !requestorIds.includes(friendId)),
      ...requestorIds,
    ].filter(userId => userId !== id);

    return ids;
  }

  async filterByFriends(userId: string): Promise<Where | null> {
    const approvedFriendIds = await this.getApprovedFriendIds(userId);

    if (!approvedFriendIds.length) return null;

    return {
      or: [
        {
          importBy: {
            inq: approvedFriendIds,
          },
        },
        {
          walletAddress: {
            inq: approvedFriendIds,
          },
        },
      ],
    };
  }

  async deleteById(id: string): Promise<void> {
    const friend = await this.friendRepository.findById(id);

    if (friend == null) return;

    await this.notificationService.cancelFriendRequest(friend.requestorId, friend.friendId);
    await this.friendRepository.deleteById(id);
  }
}

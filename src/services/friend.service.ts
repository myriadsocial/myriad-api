import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {Friend} from '../models';
import {UserRepository, FriendRepository} from '../repositories';
import {FriendStatusType} from '../enums';

export class FriendService {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
  ) {}

  async findFriend(
    friendId: string,
    requestorId: string,
  ): Promise<Friend | null> {
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

    const foundFriend = await this.friendRepository.findOne({
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

    if (foundFriend && foundFriend.status === FriendStatusType.APPROVED) {
      throw new HttpErrors.UnprocessableEntity(
        'You already friend with this user',
      );
    }

    if (foundFriend && foundFriend.status === FriendStatusType.PENDING) {
      throw new HttpErrors.UnprocessableEntity(
        'Please wait for this user to approved your request',
      );
    }

    if (foundFriend && foundFriend.status === FriendStatusType.REJECTED) {
      this.friendRepository.updateById(foundFriend.id, {
        status: FriendStatusType.PENDING,
        updatedAt: new Date().toString(),
      }) as Promise<void>;

      foundFriend.status = FriendStatusType.PENDING;
      foundFriend.updatedAt = new Date().toString();
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
}

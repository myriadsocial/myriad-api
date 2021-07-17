import {PlatformType} from '../enums';

export interface User {
  name?: string;
}

export type FriendId = {
  friendId: string;
};

export interface ExtendedUser extends User {
  platformAccountId?: string;
  username: string;
  platform: PlatformType;
  profileImageURL?: string;
  publicKey: string;
}

export interface PlatformUser {
  name: string;
  username: string;
  platformAccountId?: string;
  profileImageURL?: string;
}

export interface ExtendedPlatformUser extends PlatformUser {
  platform: string;
}

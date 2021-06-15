export interface PlatformUser {
  username: string,
  platform_account_id?: string
}

export interface Post {
  tags?: string[],
  platformUser: PlatformUser,
  platform?: string,
  text?: string,
  textId?: string,
  hasMedia?: boolean,
  link?: string,
  createdAt?: string,
  peopleId?: string,
  platformCreatedAt?: string
}
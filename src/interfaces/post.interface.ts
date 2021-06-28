export interface PlatformUser {
  username: string,
  platform_account_id?: string,
  profile_image_url?: string;
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

export interface PlatformPublicMetric {
  retweet_count?: number,
  like_count?: number,
  upvote_count?: number,
  downvote_count?: number
}
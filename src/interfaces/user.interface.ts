export interface User {
  id?: string,
  name?: string,
  platform_account_id?: string,
  username: string,
  platform: string,
  profile_image_url?: string,
  publicKey: string
}

export interface FriendId {
  friendId: string
}

export interface VerifyUser {
  publicKey: string, 
  username: string, 
  platform: string
}
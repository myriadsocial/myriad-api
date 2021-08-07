export enum ControllerType {
  USER = 'UserController',
  POST = 'PostController',
  USERPOST = 'UserPostController',
  TRANSACTION = 'TransactionController',
  EXPERIENCE = 'ExperienceController',
  PEOPLE = 'PeopleController',
  TAG = 'TagController',
  NOTIFICATION = 'NotificationController',
  CURRENCY = 'CurrencyController',
  USERCURRENCY = 'UserCurrencyController',
  USERSOCIALMEDIA = 'UserSocialMediaController',
  FRIEND = 'FriendController',
}

export enum MethodType {
  FIND = 'find',
  CREATE = 'create',
  UPDATEBYID = 'updateById',
  TIMELINE = 'timeline',
  FINDFRIENDS = 'findFriends',
  SEARCHEXPERIENCE = 'search',
  VERIFY = 'verify',
}

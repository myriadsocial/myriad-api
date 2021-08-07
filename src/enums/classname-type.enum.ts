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
  POSTCOMMENT = 'PostCommentController',
  USERCURRENCY = 'UserCurrencyController',
  USERSOCIALMEDIA = 'UserSocialMediaController',
}

export enum MethodType {
  FIND = 'find',
  CREATE = 'create',
  UPDATEBYID = 'updateById',
  TIMELINE = 'timeline',
  SEARCHEXPERIENCE = 'search',
  VERIFY = 'verify',
}

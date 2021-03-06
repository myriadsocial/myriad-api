export enum ControllerType {
  USER = 'UserController',
  POST = 'PostController',
  TRANSACTION = 'TransactionController',
  EXPERIENCE = 'ExperienceController',
  PEOPLE = 'PeopleController',
  TAG = 'TagController',
  NOTIFICATION = 'NotificationController',
  CURRENCY = 'CurrencyController',
  USERCURRENCY = 'UserCurrencyController',
  USERSOCIALMEDIA = 'UserSocialMediaController',
  USEREXPERIENCE = 'UserExperienceController',
  FRIEND = 'FriendController',
  COMMENT = 'CommentController',
  ACTIVITYLOG = 'ActivityLogController',
}

export enum MethodType {
  FIND = 'find',
  CREATE = 'create',
  CREATELIKE = 'createLike',
  UPDATEBYID = 'updateById',
  TIMELINE = 'getTimeline',
  VERIFY = 'verify',
  CLONE = 'clone',
  MODIFY = 'modify',
  CREATENEW = 'createNew',
  DELETEBYID = 'deleteById',
}

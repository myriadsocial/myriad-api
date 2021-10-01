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
  REPORT = 'ReportController',
  DELETEDCOLLECTIONCONTROLLER = 'DeletedCollectionController',
}

export enum MethodType {
  FIND = 'find',
  CREATE = 'create',
  CREATEVOTE = 'createVote',
  UPDATEBYID = 'updateById',
  UPDATEEXPERIENCE = 'updateExperience',
  TIMELINE = 'getTimeline',
  VERIFY = 'verify',
  SUBSCRIBE = 'subscribe',
  CLONE = 'clone',
  CREATENEW = 'createNew',
  DELETEBYID = 'deleteById',
  DELETEDPOSTLIST = 'deletedPostList',
  DELETEDUSERLIST = 'deletedUserList',
}

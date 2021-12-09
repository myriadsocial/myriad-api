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
  USERREPORTCONTROLLER = 'UserReportController',
  REPORTUSERCONTROLLER = 'ReportUserController',
}

export enum MethodType {
  FIND = 'find',
  FINDBYID = 'findById',
  CREATE = 'create',
  CREATEVOTE = 'createVote',
  UPDATEBYID = 'updateById',
  UPDATEEXPERIENCE = 'updateExperience',
  TIMELINE = 'getTimeline',
  VERIFY = 'verify',
  SUBSCRIBE = 'subscribe',
  CLONE = 'clone',
  CREATENEW = 'createNew',
  RESTORE = 'restore',
  DELETE = 'delete',
  DELETEBYID = 'deleteById',
  DELETEDPOSTLIST = 'deletedPostList',
  DELETEDUSERLIST = 'deletedUserList',
  SELECTCURRENCY = 'selectCurrency',
  GETIMPORTERS = 'getImporters',
}

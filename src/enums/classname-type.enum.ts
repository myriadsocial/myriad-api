export enum ControllerType {
  USER = 'UserController',
  POST = 'PostController',
  USERPOST = 'UserPostController',
  TRANSACTION = 'TransactionController',
  EXPERIENCE = 'ExperienceController',
  PEOPLE = 'PeopleController',
  TRANSACTIONHISTORY = 'TransactionHistoryController',
  TAG = 'TagController',
  NOTIFICATION = 'NotificationController',
  CRYPTOCURRENCY = 'CryptocurrencyController',
  CONVERSATION = 'ConversationController',
  POSTCOMMENT = 'PostCommentController',
  USERCRYPTOCURRENCY = 'UserCryptocurrencyController',
}

export enum MethodType {
  FIND = 'find',
  USERTIMELINE = 'userTimeLine',
  USERFRIENDLIST = 'userFriendList',
  SEARCHEXPERIENCE = 'search',
  FINDCOMMENT = 'findComment',
}

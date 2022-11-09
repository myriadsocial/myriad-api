import {
  ActivityLogRepository,
  CommentLinkRepository,
  CommentRepository,
  CurrencyRepository,
  ExperienceRepository,
  FriendRepository,
  VoteRepository,
  NotificationRepository,
  PeopleRepository,
  PostRepository,
  TransactionRepository,
  UserExperienceRepository,
  UserRepository,
  UserSocialMediaRepository,
  ReportRepository,
  UserReportRepository,
  AccountSettingRepository,
  NotificationSettingRepository,
  ExperienceUserRepository,
  TagRepository,
  DraftPostRepository,
  LanguageSettingRepository,
  ExperiencePostRepository,
  WalletRepository,
  NetworkRepository,
  UserCurrencyRepository,
  ServerRepository,
  ExchangeRateRepository,
  QueueRepository,
  UserPersonalAccessTokenRepository,
} from '../../repositories';
import {
  ActivityLogService,
  CoinMarketCapProvider,
  CurrencyService,
  ExperienceService,
  FCMService,
  FriendService,
  JWTService,
  MetricService,
  NetworkService,
  NotificationService,
  PeopleService,
  PostService,
  RedditProvider,
  ReportService,
  SocialMediaService,
  TagService,
  TransactionService,
  TwitterProvider,
  UserExperienceService,
  UserService,
  UserSocialMediaService,
  VoteService,
} from '../../services';
import {UserProfile, securityId} from '@loopback/security';
import {
  CoinMarketCapDataSource,
  RedditDataSource,
  TwitterDataSource,
} from '../../datasources';
import {CommentService} from '../../services/comment.service';

/* eslint-disable  @typescript-eslint/no-explicit-any */
export async function givenRepositories(testdb: any) {
  const userRepository: UserRepository = new UserRepository(
    testdb,
    async () => userSocialMediaRepository,
    async () => friendRepository,
    async () => experienceRepository,
    async () => userExperienceRepository,
    async () => activityLogRepository,
    async () => accountSettingRepository,
    async () => notificationSettingRepository,
    async () => peopleRepository,
    async () => languageSettingRepository,
    async () => walletRepository,
    async () => userCurrencyRepository,
    async () => currencyRepository,
  );
  const userExperienceRepository: UserExperienceRepository =
    new UserExperienceRepository(
      testdb,
      async () => experienceRepository,
      async () => userRepository,
    );
  const userSocialMediaRepository: UserSocialMediaRepository =
    new UserSocialMediaRepository(
      testdb,
      async () => userRepository,
      async () => peopleRepository,
    );
  const peopleRepository: PeopleRepository = new PeopleRepository(
    testdb,
    async () => userSocialMediaRepository,
    async () => postRepository,
    async () => userRepository,
  );
  const postRepository: PostRepository = new PostRepository(
    testdb,
    async () => peopleRepository,
    async () => userRepository,
    async () => commentRepository,
    async () => transactionRepository,
    async () => voteRepository,
    async () => experiencePostRepository,
    async () => experienceRepository,
  );
  const networkRepository: NetworkRepository = new NetworkRepository(
    testdb,
    async () => currencyRepository,
  );
  const currencyRepository: CurrencyRepository = new CurrencyRepository(
    testdb,
    async () => networkRepository,
  );
  const friendRepository: FriendRepository = new FriendRepository(
    testdb,
    async () => userRepository,
  );
  const experienceRepository: ExperienceRepository = new ExperienceRepository(
    testdb,
    async () => userRepository,
    async () => experienceUserRepository,
    async () => experiencePostRepository,
    async () => postRepository,
  );
  const experienceUserRepository: ExperienceUserRepository =
    new ExperienceUserRepository(testdb);
  const experiencePostRepository: ExperiencePostRepository =
    new ExperiencePostRepository(testdb);
  const commentRepository: CommentRepository = new CommentRepository(
    testdb,
    async () => userRepository,
    async () => transactionRepository,
    async () => commentLinkRepository,
    async () => voteRepository,
    async () => postRepository,
  );
  const transactionRepository: TransactionRepository =
    new TransactionRepository(
      testdb,
      async () => userRepository,
      async () => currencyRepository,
    );
  const voteRepository: VoteRepository = new VoteRepository(
    testdb,
    async () => postRepository,
    async () => userRepository,
  );
  const notificationRepository: NotificationRepository =
    new NotificationRepository(testdb, async () => userRepository);
  const activityLogRepository: ActivityLogRepository =
    new ActivityLogRepository(testdb, async () => userRepository);
  const commentLinkRepository: CommentLinkRepository =
    new CommentLinkRepository(testdb);
  const reportRepository: ReportRepository = new ReportRepository(
    testdb,
    async () => userReportRepository,
  );
  const userReportRepository: UserReportRepository = new UserReportRepository(
    testdb,
    async () => userRepository,
    async () => reportRepository,
  );
  const accountSettingRepository: AccountSettingRepository =
    new AccountSettingRepository(testdb, async () => userRepository);
  const notificationSettingRepository: NotificationSettingRepository =
    new NotificationSettingRepository(testdb, async () => userRepository);
  const tagRepository = new TagRepository(testdb);
  const draftPostRepository: DraftPostRepository = new DraftPostRepository(
    testdb,
  );
  const languageSettingRepository: LanguageSettingRepository =
    new LanguageSettingRepository(testdb, async () => userRepository);

  const walletRepository: WalletRepository = new WalletRepository(
    testdb,
    async () => userRepository,
    async () => networkRepository,
  );
  const userCurrencyRepository: UserCurrencyRepository =
    new UserCurrencyRepository(
      testdb,
      async () => userRepository,
      async () => currencyRepository,
      async () => networkRepository,
    );
  const serverRepository: ServerRepository = new ServerRepository(testdb);
  const exchangeRepository: ExchangeRateRepository = new ExchangeRateRepository(
    testdb,
  );
  const queueRepository: QueueRepository = new QueueRepository(testdb);
  const userPersonalAccessTokenRepository: UserPersonalAccessTokenRepository =
    new UserPersonalAccessTokenRepository(testdb, async () => userRepository);

  const dataSource = {
    reddit: new RedditDataSource(),
    twitter: new TwitterDataSource(),
    coinmarketcap: new CoinMarketCapDataSource(),
  };

  const redditService = await new RedditProvider(dataSource.reddit).value();
  const twitterService = await new TwitterProvider(dataSource.twitter).value();
  const coinmarketcapService = await new CoinMarketCapProvider(
    dataSource.coinmarketcap,
  ).value();

  const socialMediaService = new SocialMediaService(
    twitterService,
    redditService,
  );

  const metricService = new MetricService(
    voteRepository,
    commentRepository,
    postRepository,
    userRepository,
    transactionRepository,
    friendRepository,
    peopleRepository,
    notificationRepository,
    currencyRepository,
    experienceRepository,
    experiencePostRepository,
    userSocialMediaRepository,
    serverRepository,
    tagRepository,
    userCurrencyRepository,
    userExperienceRepository,
    activityLogRepository,
    reportRepository,
    userReportRepository,
    walletRepository,
    networkRepository,
  );

  const currentUser: UserProfile = {
    [securityId]: '',
  };

  const fcmService = new FCMService();

  const activityLogService = new ActivityLogService(
    activityLogRepository,
    currentUser,
  );

  const notificationService = new NotificationService(
    userRepository,
    postRepository,
    notificationRepository,
    userSocialMediaRepository,
    reportRepository,
    commentRepository,
    userReportRepository,
    notificationSettingRepository,
    currencyRepository,
    fcmService,
    currentUser,
  );

  const friendService = new FriendService(
    accountSettingRepository,
    friendRepository,
    userRepository,
    activityLogService,
    metricService,
    notificationService,
  );

  const tagService = new TagService(
    tagRepository,
    postRepository,
    friendService,
  );

  const postService = new PostService(
    accountSettingRepository,
    commentRepository,
    draftPostRepository,
    experienceRepository,
    experiencePostRepository,
    friendRepository,
    peopleRepository,
    postRepository,
    userRepository,
    userSocialMediaRepository,
    activityLogService,
    metricService,
    notificationService,
    socialMediaService,
    tagService,
  );

  const transactionService = new TransactionService(
    currencyRepository,
    peopleRepository,
    transactionRepository,
    userRepository,
    userSocialMediaRepository,
    walletRepository,
    activityLogService,
    metricService,
    notificationService,
    currentUser,
  );

  const userSocialMediaService = new UserSocialMediaService(
    userSocialMediaRepository,
    peopleRepository,
    activityLogService,
    metricService,
    notificationService,
    socialMediaService,
    currentUser,
  );

  const experienceService = new ExperienceService(
    experienceRepository,
    experiencePostRepository,
    userRepository,
    friendService,
    postService,
    currentUser,
  );

  const userExperienceService = new UserExperienceService(
    experienceRepository,
    experienceUserRepository,
    userExperienceRepository,
    userRepository,
    activityLogService,
    friendService,
    metricService,
    tagService,
  );

  const currencyService = new CurrencyService(
    currencyRepository,
    exchangeRepository,
    transactionRepository,
    queueRepository,
    userCurrencyRepository,
    walletRepository,
    notificationService,
  );

  const networkService = new NetworkService(
    currencyRepository,
    networkRepository,
    queueRepository,
    serverRepository,
    userSocialMediaRepository,
    walletRepository,
    coinmarketcapService,
    currentUser,
  );

  const reportService = new ReportService(
    reportRepository,
    commentRepository,
    experienceRepository,
    experiencePostRepository,
    friendRepository,
    peopleRepository,
    postRepository,
    userExperienceRepository,
    userRepository,
    userReportRepository,
    userSocialMediaRepository,
    metricService,
    notificationService,
  );

  const voteService = new VoteService(
    commentRepository,
    voteRepository,
    activityLogService,
    metricService,
    postService,
  );

  const commentService = new CommentService(
    commentRepository,
    postRepository,
    activityLogService,
    metricService,
    notificationService,
  );
  const jwtService = new JWTService('test', '1000000');

  const userService = new UserService(
    userRepository,
    userPersonalAccessTokenRepository,
    walletRepository,
    commentService,
    currencyService,
    userExperienceService,
    friendService,
    networkService,
    notificationService,
    postService,
    reportService,
    transactionService,
    userSocialMediaService,
    voteService,
    jwtService,
    currentUser,
  );

  const peopleService = new PeopleService(
    peopleRepository,
    userRepository,
    friendService,
    currentUser,
  );

  return {
    userRepository,
    userSocialMediaRepository,
    currencyRepository,
    friendRepository,
    experienceRepository,
    userExperienceRepository,
    peopleRepository,
    postRepository,
    commentRepository,
    transactionRepository,
    voteRepository,
    notificationRepository,
    activityLogRepository,
    commentLinkRepository,
    reportRepository,
    userReportRepository,
    accountSettingRepository,
    notificationSettingRepository,
    experienceService,
    tagRepository,
    metricService,
    notificationService,
    friendService,
    postService,
    transactionService,
    userSocialMediaService,
    draftPostRepository,
    activityLogService,
    experiencePostRepository,
    walletRepository,
    networkRepository,
    userCurrencyRepository,
    serverRepository,
    userService,
    peopleService,
    socialMediaService,
    tagService,
  };
}

export async function givenEmptyDatabase(testdb: any) {
  const {
    userRepository,
    friendRepository,
    currencyRepository,
    notificationRepository,
    transactionRepository,
    commentRepository,
    postRepository,
    userSocialMediaRepository,
    peopleRepository,
    activityLogRepository,
    commentLinkRepository,
    voteRepository,
    reportRepository,
    userReportRepository,
    accountSettingRepository,
    notificationSettingRepository,
    tagRepository,
    draftPostRepository,
    experiencePostRepository,
    walletRepository,
    networkRepository,
    userCurrencyRepository,
    serverRepository,
  } = await givenRepositories(testdb);

  await tagRepository.deleteAll();
  await peopleRepository.deleteAll();
  await userRepository.deleteAll();
  await friendRepository.deleteAll();
  await currencyRepository.deleteAll();
  await notificationRepository.deleteAll();
  await transactionRepository.deleteAll();
  await commentRepository.deleteAll();
  await postRepository.deleteAll();
  await userSocialMediaRepository.deleteAll();
  await activityLogRepository.deleteAll();
  await commentLinkRepository.deleteAll();
  await voteRepository.deleteAll();
  await reportRepository.deleteAll();
  await userReportRepository.deleteAll();
  await accountSettingRepository.deleteAll();
  await notificationSettingRepository.deleteAll();
  await draftPostRepository.deleteAll();
  await experiencePostRepository.deleteAll();
  await walletRepository.deleteAll();
  await networkRepository.deleteAll();
  await userCurrencyRepository.deleteAll();
  await serverRepository.deleteAll();
}

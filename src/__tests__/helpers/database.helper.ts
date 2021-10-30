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
  UserCurrencyRepository,
  UserExperienceRepository,
  UserRepository,
  UserSocialMediaRepository,
  ReportRepository,
  UserReportRepository,
  AccountSettingRepository,
  NotificationSettingRepository,
  ExperienceUserRepository,
  TagRepository,
} from '../../repositories';
import {
  FCMService,
  FriendService,
  MetricService,
  NotificationService,
  PostService,
  TransactionService,
  UserSocialMediaService,
} from '../../services';

/* eslint-disable  @typescript-eslint/no-explicit-any */
export async function givenRepositories(testdb: any) {
  const userRepository: UserRepository = new UserRepository(
    testdb,
    async () => userSocialMediaRepository,
    async () => userCurrencyRepository,
    async () => currencyRepository,
    async () => friendRepository,
    async () => experienceRepository,
    async () => userExperienceRepository,
    async () => activityLogRepository,
    async () => accountSettingRepository,
    async () => notificationSettingRepository,
    async () => peopleRepository,
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
  );
  const postRepository: PostRepository = new PostRepository(
    testdb,
    async () => peopleRepository,
    async () => userRepository,
    async () => commentRepository,
    async () => transactionRepository,
    async () => voteRepository,
  );
  const userCurrencyRepository: UserCurrencyRepository =
    new UserCurrencyRepository(testdb, async () => currencyRepository);
  const currencyRepository: CurrencyRepository = new CurrencyRepository(testdb);
  const friendRepository: FriendRepository = new FriendRepository(
    testdb,
    async () => userRepository,
  );
  const experienceRepository: ExperienceRepository = new ExperienceRepository(
    testdb,
    async () => userRepository,
    async () => experienceUserRepository,
  );
  const experienceUserRepository: ExperienceUserRepository =
    new ExperienceUserRepository(testdb);
  const commentRepository: CommentRepository = new CommentRepository(
    testdb,
    async () => userRepository,
    async () => transactionRepository,
    async () => commentLinkRepository,
    async () => voteRepository,
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
  const tagRepository: TagRepository = new TagRepository(testdb);

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
    userSocialMediaRepository,
    tagRepository,
    userExperienceRepository,
    activityLogRepository,
    reportRepository,
    userReportRepository,
  );

  const fcmService = new FCMService();

  const notificationService = new NotificationService(
    userRepository,
    postRepository,
    notificationRepository,
    userSocialMediaRepository,
    friendRepository,
    reportRepository,
    commentRepository,
    userReportRepository,
    notificationSettingRepository,
    fcmService,
  );

  const friendService = new FriendService(
    friendRepository,
    userRepository,
    notificationService,
  );


  const postService = new PostService(
    postRepository,
    peopleRepository,
    commentRepository,
    friendRepository,
    voteRepository,
    metricService,
  );

  const transactionService = new TransactionService(transactionRepository);

  const userSocialMediaService = new UserSocialMediaService(
    userSocialMediaRepository,
    peopleRepository,
    notificationService,
  );

  return {
    userRepository,
    userSocialMediaRepository,
    userCurrencyRepository,
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
    tagRepository,
    metricService,
    notificationService,
    friendService,
    postService,
    transactionService,
    userSocialMediaService,
  };
}

export async function givenEmptyDatabase(testdb: any) {
  const {
    userRepository,
    userCurrencyRepository,
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
  } = await givenRepositories(testdb);

  await tagRepository.deleteAll();
  await peopleRepository.deleteAll();
  await userRepository.deleteAll();
  await userCurrencyRepository.deleteAll();
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
}

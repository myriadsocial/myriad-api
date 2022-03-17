import {MyriadApiApplication} from '../../application';
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
  TagRepository,
  TransactionRepository,
  UserCurrencyRepository,
  UserExperienceRepository,
  UserRepository,
  UserSocialMediaRepository,
  ReportRepository,
  UserReportRepository,
  NotificationSettingRepository,
  AccountSettingRepository,
  WalletRepository,
} from '../../repositories';

export async function givenUserRepository(app: MyriadApiApplication) {
  return app.getRepository(UserRepository);
}

export async function givenFriendRepository(app: MyriadApiApplication) {
  return app.getRepository(FriendRepository);
}

export async function givenCurrencyRepository(app: MyriadApiApplication) {
  return app.getRepository(CurrencyRepository);
}

export async function givenPeopleRepository(app: MyriadApiApplication) {
  return app.getRepository(PeopleRepository);
}

export async function givenCommentRepository(app: MyriadApiApplication) {
  return app.getRepository(CommentRepository);
}

export async function givenPostRepository(app: MyriadApiApplication) {
  return app.getRepository(PostRepository);
}

export async function givenVoteRepository(app: MyriadApiApplication) {
  return app.getRepository(VoteRepository);
}

export async function givenNotificationRepository(app: MyriadApiApplication) {
  return app.getRepository(NotificationRepository);
}

export async function givenUserSocialMediaRepository(
  app: MyriadApiApplication,
) {
  return app.getRepository(UserSocialMediaRepository);
}

export async function givenTagRepository(app: MyriadApiApplication) {
  return app.getRepository(TagRepository);
}

export async function givenTransactionRepository(app: MyriadApiApplication) {
  return app.getRepository(TransactionRepository);
}

export async function givenUserCurrencyRepository(app: MyriadApiApplication) {
  return app.getRepository(UserCurrencyRepository);
}

export async function givenActivityLogRepository(app: MyriadApiApplication) {
  return app.getRepository(ActivityLogRepository);
}

export async function givenExperienceRepository(app: MyriadApiApplication) {
  return app.getRepository(ExperienceRepository);
}

export async function givenUserExperienceRepository(app: MyriadApiApplication) {
  return app.getRepository(UserExperienceRepository);
}

export async function givenCommentLinkRepository(app: MyriadApiApplication) {
  return app.getRepository(CommentLinkRepository);
}

export async function givenReportRepository(app: MyriadApiApplication) {
  return app.getRepository(ReportRepository);
}

export async function givenUserReportRepository(app: MyriadApiApplication) {
  return app.getRepository(UserReportRepository);
}

export async function givenAccountSettingRepository(app: MyriadApiApplication) {
  return app.getRepository(AccountSettingRepository);
}

export async function givenNotificationSettingRepository(
  app: MyriadApiApplication,
) {
  return app.getRepository(NotificationSettingRepository);
}

export async function givenWalletRepository(app: MyriadApiApplication) {
  return app.getRepository(WalletRepository);
}

export async function deleteAllRepository(app: MyriadApiApplication) {
  const userRepository = await givenUserRepository(app);
  const friendRepository = await givenFriendRepository(app);
  const currencyRepository = await givenCurrencyRepository(app);
  const peopleRepository = await givenPeopleRepository(app);
  const commentRepository = await givenCommentRepository(app);
  const postRepository = await givenPostRepository(app);
  const voteRepository = await givenVoteRepository(app);
  const notificationRepository = await givenNotificationRepository(app);
  const userSocialMediaRepository = await givenUserSocialMediaRepository(app);
  const tagRepository = await givenTagRepository(app);
  const transactionRepository = await givenTransactionRepository(app);
  const userCurrencyRepository = await givenUserCurrencyRepository(app);
  const activityLogRepository = await givenActivityLogRepository(app);
  const experienceRepository = await givenExperienceRepository(app);
  const userExperienceRepository = await givenUserExperienceRepository(app);
  const commentLinkRepository = await givenCommentLinkRepository(app);
  const reportRepository = await givenReportRepository(app);
  const userReportRepository = await givenUserReportRepository(app);
  const accountSettingRepository = await givenAccountSettingRepository(app);
  const walletRepository = await givenWalletRepository(app);
  const notificationSettingRepository =
    await givenNotificationSettingRepository(app);

  await userRepository.deleteAll();
  await friendRepository.deleteAll();
  await currencyRepository.deleteAll();
  await peopleRepository.deleteAll();
  await commentRepository.deleteAll();
  await postRepository.deleteAll();
  await voteRepository.deleteAll();
  await notificationRepository.deleteAll();
  await userSocialMediaRepository.deleteAll();
  await tagRepository.deleteAll();
  await transactionRepository.deleteAll();
  await userCurrencyRepository.deleteAll();
  await activityLogRepository.deleteAll();
  await experienceRepository.deleteAll();
  await userExperienceRepository.deleteAll();
  await commentLinkRepository.deleteAll();
  await reportRepository.deleteAll();
  await userReportRepository.deleteAll();
  await accountSettingRepository.deleteAll();
  await notificationSettingRepository.deleteAll();
  await walletRepository.deleteAll();
}

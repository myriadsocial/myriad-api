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
  PostImporterRepository,
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

export async function givenPostImporterRepository(app: MyriadApiApplication) {
  return app.getRepository(PostImporterRepository);
}

import {MyriadApiApplication} from '../../application';
import {
  ActivityLogRepository,
  CommentRepository,
  CurrencyRepository,
  ExperienceRepository,
  FriendRepository,
  LikeRepository,
  NotificationRepository,
  PeopleRepository,
  PostRepository,
  TagRepository,
  TransactionRepository,
  UserCurrencyRepository,
  UserExperienceRepository,
  UserRepository,
  UserSocialMediaRepository,
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

export async function givenLikeRepository(app: MyriadApiApplication) {
  return app.getRepository(LikeRepository);
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

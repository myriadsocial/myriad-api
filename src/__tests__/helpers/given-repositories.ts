import {MyriadApiApplication} from '../../application';
import {
  CommentRepository,
  CurrencyRepository,
  FriendRepository,
  PeopleRepository,
  PostRepository,
  UserRepository,
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

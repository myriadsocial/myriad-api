import {MyriadApiApplication} from '../../application';
import {
  CurrencyRepository,
  FriendRepository,
  PeopleRepository,
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

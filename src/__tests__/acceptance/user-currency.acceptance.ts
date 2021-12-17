import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {DefaultCurrencyType} from '../../enums';
import {
  CurrencyRepository,
  UserCurrencyRepository,
  UserRepository,
  AuthenticationRepository,
} from '../../repositories';
import {
  givenCurrencyInstance,
  givenCurrencyRepository,
  givenUserCurrency,
  givenUserCurrencyInstance,
  givenUserCurrencyRepository,
  givenUserInstance,
  givenUserRepository,
  givenAuthenticationRepository,
  setupApplication,
} from '../helpers';

describe('UserCurrencyApplication', function () {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let userCurrencyRepository: UserCurrencyRepository;
  let currencyRepository: CurrencyRepository;
  let userRepository: UserRepository;
  let authenticationRepository: AuthenticationRepository;

  const userCredential = {
    email: 'admin@mail.com',
    password: '123456',
  };

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    authenticationRepository = await givenAuthenticationRepository(app);
    userCurrencyRepository = await givenUserCurrencyRepository(app);
    currencyRepository = await givenCurrencyRepository(app);
    userRepository = await givenUserRepository(app);
  });

  before(async () => {
    await givenCurrencyInstance(currencyRepository);
  });

  after(async () => {
    await userCurrencyRepository.deleteAll();
    await currencyRepository.deleteAll();
    await userRepository.deleteAll();
    await authenticationRepository.deleteAll();
  });

  it('sign up successfully', async () => {
    await client.post('/signup').send(userCredential).expect(200);
  });

  it('user login successfully', async () => {
    const res = await client.post('/login').send(userCredential).expect(200);
    token = res.body.accessToken;
  });

  it('creates a user currency', async function () {
    const userCurrency = givenUserCurrency();
    const response = await client
      .post('/user-currencies')
      .set('Authorization', `Bearer ${token}`)
      .send(userCurrency)
      .expect(200);
    expect(response.body).to.containDeep(userCurrency);
    const result = await userCurrencyRepository.findById(response.body.id);
    expect(result).to.containDeep(userCurrency);
  });

  it('selects a user default currency', async () => {
    const user = await givenUserInstance(userRepository);
    const currency = await givenCurrencyInstance(currencyRepository, {
      id: DefaultCurrencyType.MYRIA,
    });

    await givenUserCurrencyInstance(userCurrencyRepository, {
      userId: user.id,
      currencyId: currency.id,
    });

    await client
      .patch(`/users/${user.id}/select-currency/${DefaultCurrencyType.MYRIA}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    const result = await userRepository.findById(user.id);
    expect(result.defaultCurrency).to.equal(DefaultCurrencyType.MYRIA);
  });

  it('returns 404 when creates user currency but the currency not exist', async () => {
    const userCurrency = givenUserCurrency({
      currencyId: 'DOT',
    });
    await client
      .post('/user-currencies')
      .set('Authorization', `Bearer ${token}`)
      .send(userCurrency)
      .expect(404);
  });

  it('returns 422 when user already has specific currency', async () => {
    const userCurrency = givenUserCurrency();
    await client
      .post('/user-currencies')
      .set('Authorization', `Bearer ${token}`)
      .send(userCurrency)
      .expect(422);
  });

  it('deletes the user currency', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee62164',
      defaultCurrency: DefaultCurrencyType.MYRIA,
    });

    await givenUserCurrencyInstance(userCurrencyRepository, {
      userId: user.id,
      currencyId: 'ROC',
    });

    const userCurrency = givenUserCurrency({userId: user.id});

    await client
      .del(`/user-currencies`)
      .set('Authorization', `Bearer ${token}`)
      .send({userId: userCurrency.userId, currencyId: userCurrency.currencyId})
      .expect(200, {count: 1});

    expect(
      await userCurrencyRepository.findOne({
        where: {
          userId: userCurrency.userId,
          currencyId: userCurrency.currencyId,
        },
      }),
    ).to.be.equal(null);
  });
});

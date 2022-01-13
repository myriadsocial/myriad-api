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
  givenCurrencyRepository,
  givenUserCurrency,
  givenUserCurrencyInstance,
  givenUserCurrencyRepository,
  givenUserInstance,
  givenUserRepository,
  givenAuthenticationRepository,
  setupApplication,
  givenMultipleCurrencyInstances,
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
    await givenMultipleCurrencyInstances(currencyRepository);
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

    userCurrency.priority = 1;

    expect(response.body).to.containDeep(userCurrency);
    const result = await userCurrencyRepository.findById(response.body.id);
    expect(result).to.containDeep(userCurrency);
  });

  it('update user currency priority', async function () {
    const userId =
      '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b3m5e8449ee61864';
    await givenUserInstance(userRepository, {id: userId});

    const userCurrency1 = givenUserCurrency({userId});
    await client
      .post('/user-currencies')
      .set('Authorization', `Bearer ${token}`)
      .send(userCurrency1)
      .expect(200);

    const userCurrency2 = givenUserCurrency({currencyId: 'ACA', userId});
    await client
      .post('/user-currencies')
      .set('Authorization', `Bearer ${token}`)
      .send(userCurrency2)
      .expect(200);

    const currencyPriority = {
      userId: userId,
      currencies: [userCurrency2.currencyId, userCurrency1.currencyId],
    };

    await client
      .patch('/user-currencies')
      .set('Authorization', `Bearer ${token}`)
      .send(currencyPriority)
      .expect(204);

    const result = await userCurrencyRepository.find({where: {userId}});

    expect(result).to.containDeep([
      {
        userId: userId,
        currencyId: currencyPriority.currencies[0],
        priority: 1,
      },
      {
        userId: userId,
        currencyId: currencyPriority.currencies[1],
        priority: 2,
      },
    ]);
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

import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {
  CurrencyRepository,
  UserCurrencyRepository,
  UserRepository,
} from '../../repositories';
import {
  givenAccesToken,
  givenCurrencyRepository,
  givenUserCurrency,
  givenUserCurrencyRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
  givenMultipleCurrencyInstances,
} from '../helpers';
import {u8aToHex, numberToHex} from '@polkadot/util';
import {KeyringPair} from '@polkadot/keyring/types';
import {Credential, Currency, User} from '../../models';

describe('UserCurrencyApplication', function () {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let userCurrencyRepository: UserCurrencyRepository;
  let currencyRepository: CurrencyRepository;
  let userRepository: UserRepository;
  let nonce: number;
  let user: User;
  let otherUser: User;
  let address: KeyringPair;
  let currency: Currency;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
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
  });

  it('gets user nonce', async () => {
    const response = await client.get(`/users/${user.id}/nonce`).expect(200);

    nonce = response.body.nonce;
  });

  it('user login successfully', async () => {
    const credential: Credential = new Credential({
      nonce: nonce,
      publicAddress: user.id,
      signature: u8aToHex(address.sign(numberToHex(nonce))),
    });

    const res = await client.post('/login').send(credential).expect(200);
    token = res.body.accessToken;
  });

  it('returns 401 whens creating a user currency not as login user', async () => {
    const accessToken = await givenAccesToken(otherUser);
    const userCurrency = givenUserCurrency({userId: user.id});
    await client
      .post('/user-currencies')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(userCurrency)
      .expect(401);
  });

  it('creates a user currency', async function () {
    const userCurrency = givenUserCurrency({userId: user.id});
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
      userId: user.id,
      currencyId: 'DOT',
    });
    await client
      .post('/user-currencies')
      .set('Authorization', `Bearer ${token}`)
      .send(userCurrency)
      .expect(404);
  });

  it('deletes the user currency', async () => {
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

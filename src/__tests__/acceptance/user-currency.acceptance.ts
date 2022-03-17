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
  givenOtherUser,
  givenUserCurrency,
  givenUserCurrencyRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
  givenMultipleCurrencyInstances,
  givenUserCurrencyInstance,
  deleteAllRepository,
} from '../helpers';
import {User} from '../../models';

describe('UserCurrencyApplication', function () {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let userCurrencyRepository: UserCurrencyRepository;
  let currencyRepository: CurrencyRepository;
  let userRepository: UserRepository;
  let user: User;
  let otherUser: User;

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
    user = await givenUserInstance(userRepository, {defaultCurrency: 'ROC'});
    otherUser = await givenUserInstance(userRepository, givenOtherUser());
    token = await givenAccesToken(user);

    await givenMultipleCurrencyInstances(currencyRepository);
  });

  after(async () => {
    await deleteAllRepository(app);
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
    const userCurrency1 = givenUserCurrency({userId: otherUser.id});
    const accessToken = await givenAccesToken(otherUser);
    await client
      .post('/user-currencies')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(userCurrency1)
      .expect(200);

    const userCurrency2 = givenUserCurrency({
      currencyId: 'ACA',
      userId: otherUser.id,
    });
    await client
      .post('/user-currencies')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(userCurrency2)
      .expect(200);

    const currencyPriority = {
      userId: otherUser.id,
      currencies: [userCurrency2.currencyId, userCurrency1.currencyId],
    };

    await client
      .patch('/user-currencies')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(currencyPriority)
      .expect(204);
    const result = await userCurrencyRepository.find({
      where: {userId: otherUser.id},
    });

    expect(result).to.containDeep([
      {
        userId: otherUser.id,
        currencyId: currencyPriority.currencies[0],
        priority: 1,
      },
      {
        userId: otherUser.id,
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

  it('return 422 when deletes the only user currency', async () => {
    const userCurrency = givenUserCurrency({userId: user.id});

    await client
      .del(`/user-currencies`)
      .set('Authorization', `Bearer ${token}`)
      .send({userId: userCurrency.userId, currencyId: userCurrency.currencyId})
      .expect(422);
  });

  it('returns 401 when deleting user currency not as login user', async () => {
    const accessToken = await givenAccesToken(otherUser);
    const userCurrency = givenUserCurrency({userId: user.id});

    await client
      .del('/user-currencies')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({userId: userCurrency.userId, currencyId: userCurrency.currencyId})
      .expect(401);
  });

  it('deletes the user currency', async () => {
    await givenUserCurrencyInstance(userCurrencyRepository, {
      userId: user.id,
      currencyId: 'ACA',
    });
    const userCurrency = givenUserCurrency({
      userId: user.id,
    });

    await client
      .del(`/user-currencies`)
      .set('Authorization', `Bearer ${token}`)
      .send({userId: userCurrency.userId, currencyId: 'ACA'})
      .expect(204);

    expect(
      await userCurrencyRepository.findOne({
        where: {
          userId: userCurrency.userId,
          currencyId: 'ACA',
        },
      }),
    ).to.be.equal(null);
  });
});

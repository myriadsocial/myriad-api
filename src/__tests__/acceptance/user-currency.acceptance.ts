import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {DefaultCurrencyType} from '../../enums';
import {CurrencyRepository, UserCurrencyRepository} from '../../repositories';
import {
  givenCurrencyInstance,
  givenCurrencyRepository,
  givenUserCurrency,
  givenUserCurrencyRepository,
  setupApplication,
} from '../helpers';

describe('UserCurrencyApplication', function () {
  let app: MyriadApiApplication;
  let client: Client;
  let userCurrencyRepository: UserCurrencyRepository;
  let currencyRepository: CurrencyRepository;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    userCurrencyRepository = await givenUserCurrencyRepository(app);
    currencyRepository = await givenCurrencyRepository(app);
  });

  before(async () => {
    await givenCurrencyInstance(currencyRepository);
  });

  after(async () => {
    await userCurrencyRepository.deleteAll();
    await currencyRepository.deleteAll();
  });

  it('creates a user currency', async function () {
    const userCurrency = givenUserCurrency();
    const response = await client.post('/user-currencies').send(userCurrency).expect(200);
    expect(response.body).to.containDeep(userCurrency);
    const result = await userCurrencyRepository.findById(response.body.id);
    expect(result).to.containDeep(userCurrency);
  });

  it('returns 404 when creates user currency but the currency not exist', async () => {
    const userCurrency = givenUserCurrency({currencyId: DefaultCurrencyType.MYRIA});
    await client.post('/user-currencies').send(userCurrency).expect(404);
  });

  it('returns 422 when user already has specific currency', async () => {
    const userCurrency = givenUserCurrency();
    await client.post('/user-currencies').send(userCurrency).expect(422);
  });

  it('deletes the user currency', async () => {
    const userCurrency = givenUserCurrency();
    await client
      .del(`/user-currencies`)
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

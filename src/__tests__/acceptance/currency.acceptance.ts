import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {Currency, User} from '../../models/';
import {
  CurrencyRepository,
  UserRepository,
  WalletRepository,
} from '../../repositories/';
import {
  deleteAllRepository,
  givenAccesToken,
  givenCurrency,
  givenCurrencyInstance,
  givenCurrencyRepository,
  givenMultipleCurrencyInstances,
  givenOtherUser,
  givenUserInstance,
  givenUserRepository,
  givenWalletInstance,
  givenWalletRepository,
  setupApplication,
} from '../helpers';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('CurrencyApplication', function () {
  this.timeout(100000);
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let currencyRepository: CurrencyRepository;
  let userRepository: UserRepository;
  let walletRepository: WalletRepository;
  let user: User;

  before(async () => {
    ({app, client} = await setupApplication());
  });
  after(() => app.stop());

  before(async () => {
    currencyRepository = await givenCurrencyRepository(app);
    userRepository = await givenUserRepository(app);
    walletRepository = await givenWalletRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    token = await givenAccesToken(user);

    await givenWalletInstance(walletRepository, {userId: user.id});
  });

  beforeEach(async () => {
    await currencyRepository.deleteAll();
  });

  after(async () => {
    await deleteAllRepository(app);
  });

  it('rejects requests to create a currency with no id', async () => {
    const currency: Partial<Currency> = givenCurrency();
    delete currency.id;
    await client
      .post('/currencies')
      .set('Authorization', `Bearer ${token}`)
      .send(currency)
      .expect(422);
  });

  it('rejects requests to create a currency with no image', async () => {
    const currency: Partial<Currency> = givenCurrency();
    delete currency.image;
    await client
      .post('/currencies')
      .set('Authorization', `Bearer ${token}`)
      .send(currency)
      .expect(422);
  });

  it('rejects requests to create a currency with no rpcURL', async () => {
    const currency: Partial<Currency> = givenCurrency();
    delete currency.rpcURL;
    await client
      .post('/currencies')
      .set('Authorization', `Bearer ${token}`)
      .send(currency)
      .expect(422);
  });

  it('rejects request when creates a currency not as admin myriad', async () => {
    const currency = givenCurrency();
    const otherUser = await givenUserInstance(userRepository, givenOtherUser());
    const accessToken = await givenAccesToken(otherUser);

    await client
      .post('/currencies')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(currency)
      .expect(403);
  });

  context('when dealing with a single persisted currency', () => {
    let persistedCurrency: Currency;

    beforeEach(async () => {
      persistedCurrency = await givenCurrencyInstance(currencyRepository);
    });

    it('gets a currency by ID', () => {
      return client
        .get(`/currencies/${persistedCurrency.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200, toJSON(persistedCurrency));
    });

    it('returns 401 when updating a currency not as myriad admin', async function () {
      const updatedCurrency: Partial<Currency> = givenCurrency();

      delete updatedCurrency.id;
      const otherUser = await givenUserInstance(
        userRepository,
        givenOtherUser({username: 'jojon'}),
      );
      const accessToken = await givenAccesToken(otherUser);

      await client
        .patch(`/currencies/${persistedCurrency.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updatedCurrency)
        .expect(403);
    });

    it('returns 404 when getting a currency that does not exist', () => {
      return client
        .get('/currencies/99999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('deletes the currency', async () => {
      await client
        .del(`/currencies/${persistedCurrency.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(204);
      await expect(
        currencyRepository.findById(persistedCurrency.id),
      ).to.be.rejectedWith(EntityNotFoundError);
    });

    it('returns 404 when deleting a currency that does not exist', async () => {
      await client
        .del(`/currencies/99999`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  context('when dealing with multiple persisted currencies', () => {
    let persistedCurrencies: Currency[];

    beforeEach(async () => {
      persistedCurrencies = await givenMultipleCurrencyInstances(
        currencyRepository,
      );
    });

    it('finds all currencies', async () => {
      const response = await client
        .get('/currencies')
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      expect(response.body.data).to.containDeep(toJSON(persistedCurrencies));
    });

    it('queries currencies with a filter', async () => {
      const currencyInProgress = await givenCurrencyInstance(
        currencyRepository,
        {
          id: 'AUSD',
          decimal: 13,
          image: 'https://apps.acala.network/static/media/AUSD.439bc3f2.png',
          native: true,
          rpcURL: 'wss://acala-mandala.api.onfinality.io/public-ws',
          networkType: 'substrate-test',
        },
      );

      const filter = 'filter=' + JSON.stringify({where: {id: 'AUSD'}});

      await client
        .get('/currencies')
        .set('Authorization', `Bearer ${token}`)
        .query(filter)
        .expect(200, {
          data: [toJSON(currencyInProgress)],
          meta: {
            currentPage: 1,
            itemsPerPage: 1,
            totalItemCount: 1,
            totalPageCount: 1,
          },
        });
    });

    it('exploded filter conditions work', async () => {
      await givenCurrencyInstance(currencyRepository, {
        id: 'MYRIA',
        decimal: 12,
        image: 'https://apps.acala.network/static/media/AUSD.439bc3f2.png',
        native: false,
        rpcURL: 'wss://acala-mandala.api.onfinality.io/public-ws',
      });

      const response = await client
        .get('/currencies')
        .set('Authorization', `Bearer ${token}`)
        .query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });
});

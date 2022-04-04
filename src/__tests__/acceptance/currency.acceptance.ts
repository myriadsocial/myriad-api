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
  givenCurrencyInstance,
  givenCurrencyRepository,
  givenMultipleCurrencyInstances,
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
          name: 'acala AUSD',
          symbol: 'AUSD',
          decimal: 12,
          image: 'https://apps.acala.network/static/media/AUSD.439bc3f2.png',
          native: true,
          exchangeRate: true,
          networkId: 'acala',
        },
      );

      const filter = 'filter=' + JSON.stringify({where: {symbol: 'AUSD'}});

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
        name: 'myriad',
        symbol: 'MYRIA',
        decimal: 12,
        image: 'https://apps.acala.network/static/media/AUSD.439bc3f2.png',
        native: true,
        exchangeRate: false,
        networkId: 'myria',
      });

      const response = await client
        .get('/currencies')
        .set('Authorization', `Bearer ${token}`)
        .query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });
});

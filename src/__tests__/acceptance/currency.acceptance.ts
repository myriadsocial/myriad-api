import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {Currency} from '../../models/';
import {CurrencyRepository} from '../../repositories/';
import {
  givenCurrency,
  givenCurrencyInstance,
  givenCurrencyRepository,
  givenMultipleCurrencyInstances,
  setupApplication,
} from '../helpers';

describe('CurrencyApplication', () => {
  let app: MyriadApiApplication;
  let client: Client;
  let currencyRepository: CurrencyRepository;

  before(async () => {
    ({app, client} = await setupApplication());
  });
  after(() => app.stop());

  before(async () => {
    currencyRepository = await givenCurrencyRepository(app);
  });

  beforeEach(async () => {
    await currencyRepository.deleteAll();
  });

  it('creates a currency', async function () {
    const currency = givenCurrency();
    const response = await client
      .post('/currencies')
      .send(currency)
      .expect(200);
    expect(response.body).to.containDeep(currency);
    const result = await currencyRepository.findById(response.body.id);
    expect(result).to.containDeep(currency);
  });

  it('rejects requests to create a currency with no id', async () => {
    const currency: Partial<Currency> = givenCurrency();
    delete currency.id;
    await client.post('/currencies').send(currency).expect(422);
  });

  it('rejects requests to create a currency with no name', async () => {
    const currency: Partial<Currency> = givenCurrency();
    delete currency.name;
    await client.post('/currencies').send(currency).expect(422);
  });

  it('rejects requests to create a currency with no image', async () => {
    const currency: Partial<Currency> = givenCurrency();
    delete currency.image;
    await client.post('/currencies').send(currency).expect(422);
  });

  it('rejects requests to create a currency with no decimal', async () => {
    const currency: Partial<Currency> = givenCurrency();
    delete currency.decimal;
    await client.post('/currencies').send(currency).expect(422);
  });

  it('rejects requests to create a currency with no addressType', async () => {
    const currency: Partial<Currency> = givenCurrency();
    delete currency.addressType;
    await client.post('/currencies').send(currency).expect(422);
  });

  it('rejects requests to create a currency with no rpcURL', async () => {
    const currency: Partial<Currency> = givenCurrency();
    delete currency.rpcURL;
    await client.post('/currencies').send(currency).expect(422);
  });

  context('when dealing with a single persisted currency', () => {
    let persistedCurrency: Currency;

    beforeEach(async () => {
      persistedCurrency = await givenCurrencyInstance(currencyRepository);
    });

    it('gets a currency by ID', () => {
      return client
        .get(`/currencies/${persistedCurrency.id}`)
        .send()
        .expect(200, toJSON(persistedCurrency));
    });

    it('returns 404 when getting a currency that does not exist', () => {
      return client.get('/currencies/99999').expect(404);
    });

    it('deletes the currency', async () => {
      await client
        .del(`/currencies/${persistedCurrency.id}`)
        .send()
        .expect(204);
      await expect(
        currencyRepository.findById(persistedCurrency.id),
      ).to.be.rejectedWith(EntityNotFoundError);
    });

    it('returns 404 when deleting a currency that does not exist', async () => {
      await client.del(`/currencies/99999`).expect(404);
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
      const response = await client.get('/currencies').send().expect(200);
      expect(response.body.data).to.containDeep(toJSON(persistedCurrencies));
    });

    it('queries currencies with a filter', async () => {
      const currencyInProgress = await givenCurrencyInstance(
        currencyRepository,
        {
          id: 'DOT',
          name: 'polkadot',
          decimal: 10,
          image: 'https://apps.acala.network/static/media/AUSD.439bc3f2.png',
          addressType: 42,
          native: false,
          rpcURL: 'wss://acala-mandala.api.onfinality.io/public-ws',
        },
      );

      const filter = 'filter=' + JSON.stringify({where: {name: 'polkadot'}});

      await client
        .get('/currencies')
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
        name: 'myriad',
        decimal: 12,
        image: 'https://apps.acala.network/static/media/AUSD.439bc3f2.png',
        addressType: 42,
        native: false,
        rpcURL: 'wss://acala-mandala.api.onfinality.io/public-ws',
      });

      const response = await client.get('/currencies').query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });
});

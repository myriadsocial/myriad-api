import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {DefaultCurrencyType} from '../../enums';
import {Credential, Currency, Transaction, User} from '../../models';
import {
  CurrencyRepository,
  TransactionRepository,
  UserRepository,
} from '../../repositories';
import {
  givenAddress,
  givenCurrencyInstance,
  givenCurrencyRepository,
  givenTransaction,
  givenTransactionInstance,
  givenTransactionRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';
import {u8aToHex, numberToHex} from '@polkadot/util';
import {KeyringPair} from '@polkadot/keyring/types';

describe('TransactionApplication', function () {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let userRepository: UserRepository;
  let currencyRepository: CurrencyRepository;
  let transactionRepository: TransactionRepository;
  let currency: Currency;
  let nonce: number;
  let user: User;
  let address: KeyringPair;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    userRepository = await givenUserRepository(app);
    currencyRepository = await givenCurrencyRepository(app);
    transactionRepository = await givenTransactionRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    address = givenAddress();
  });

  before(async () => {
    currency = await givenCurrencyInstance(currencyRepository);
  });

  after(async () => {
    await userRepository.deleteAll();
    await currencyRepository.deleteAll();
  });

  beforeEach(async () => {
    await transactionRepository.deleteAll();
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

  it('creates a transaction', async function () {
    const transaction = givenTransaction({
      from: user.id,
      currencyId: currency.id,
    });
    const response = await client
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(transaction)
      .expect(200);
    expect(response.body).to.containDeep(transaction);
    const result = await transactionRepository.findById(response.body.id);
    expect(result).to.containDeep(transaction);
  });

  it('returns 401 when creates transactions but "from user" not exist', async () => {
    const transaction = givenTransaction({
      from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61860',
      currencyId: currency.id,
    });

    await client
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(transaction)
      .expect(401);
  });

  it('returns 422 when create transactions but "currency" not exist', async () => {
    const transaction = givenTransaction({
      from: user.id,
      currencyId: DefaultCurrencyType.MYRIA,
    });

    await client
      .post('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(transaction)
      .expect(404);
  });

  context('when dealing with a single persisted transaction', () => {
    let persistedTransaction: Transaction;

    beforeEach(async () => {
      persistedTransaction = await givenTransactionInstance(
        transactionRepository,
      );
    });

    it('gets a transaction by ID', async () => {
      const result = await client
        .get(`/transactions/${persistedTransaction.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      const expected = toJSON(persistedTransaction);

      expect(result.body).to.deepEqual(expected);
    });

    it('returns 404 when getting a transaction that does not exist', () => {
      return client
        .get('/transaction/99999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  context('when dealing with multiple persisted transactions', () => {
    let persistedTransactions: Transaction[];
    let otherUser: User;

    before(async () => {
      otherUser = await givenUserInstance(userRepository, {
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
        name: 'irman',
      });
    });

    beforeEach(async () => {
      persistedTransactions = [
        await givenTransactionInstance(transactionRepository, {from: user.id}),
        await givenTransactionInstance(transactionRepository, {
          from: otherUser.id,
        }),
      ];
    });

    it('finds all transactions', async () => {
      const response = await client
        .get('/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      expect(response.body.data).to.containDeep(toJSON(persistedTransactions));
    });

    it('queries transactions with a filter', async () => {
      const transactionInProgress = await givenTransactionInstance(
        transactionRepository,
        {
          from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61811',
          to: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61824',
        },
      );

      const response = await client
        .get('/transactions')
        .set('Authorization', `Bearer ${token}`)
        .query(
          JSON.stringify({
            filter: {
              where: {
                from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61811',
                to: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61824',
              },
            },
          }),
        )
        .expect(200);

      expect(response.body.data).to.containDeep([
        toJSON(transactionInProgress),
      ]);
    });

    it('exploded filter conditions work', async () => {
      await givenTransactionInstance(transactionRepository);

      const response = await client
        .get('/transactions')
        .set('Authorization', `Bearer ${token}`)
        .query('pageLimit=2');

      expect(response.body.data).to.have.length(2);
    });
  });

  it('includes fromUser, toUser, and currency in query result', async () => {
    const otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61851',
      name: 'irman',
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      from: user.id,
      to: otherUser.id,
    });

    const response = await client
      .get('/transactions')
      .set('Authorization', `Bearer ${token}`)
      .query({
        filter: {
          include: ['fromUser', 'toUser', 'currency'],
        },
      })
      .expect(200);

    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0]).to.deepEqual({
      ...toJSON(transaction),
      fromUser: toJSON(user),
      toUser: toJSON(otherUser),
      currency: toJSON(currency),
    });
  });
});

import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {DefaultCurrencyType} from '../../enums';
import {Currency, Transaction, User} from '../../models';
import {CurrencyRepository, TransactionRepository, UserRepository} from '../../repositories';
import {
  givenCurrencyInstance,
  givenCurrencyRepository,
  givenTransaction,
  givenTransactionInstance,
  givenTransactionRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';

describe('TransactionApplication', function () {
  let app: MyriadApiApplication;
  let client: Client;
  let userRepository: UserRepository;
  let currencyRepository: CurrencyRepository;
  let transactionRepository: TransactionRepository;
  let user: User;
  let currency: Currency;

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
    currency = await givenCurrencyInstance(currencyRepository);
  });

  after(async () => {
    await userRepository.deleteAll();
    await currencyRepository.deleteAll();
  });

  beforeEach(async () => {
    await transactionRepository.deleteAll();
  });

  it('creates a transaction', async function () {
    const transaction = givenTransaction({from: user.id, currencyId: currency.id});
    const response = await client.post('/transactions').send(transaction).expect(200);
    expect(response.body).to.containDeep(transaction);
    const result = await transactionRepository.findById(response.body.id);
    expect(result).to.containDeep(transaction);
  });

  it('returns 404 when creates transactions but "from user" not exist', async () => {
    const transaction = givenTransaction({
      from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61860',
      currencyId: currency.id,
    });

    await client.post('/transactions').send(transaction).expect(404);
  });

  it('returns 422 when create transactions but "currency" not exist', async () => {
    const transaction = givenTransaction({
      from: user.id,
      currencyId: DefaultCurrencyType.MYRIA,
    });

    await client.post('/transactions').send(transaction).expect(404);
  });

  context('when dealing with a single persisted transaction', () => {
    let persistedTransaction: Transaction;

    beforeEach(async () => {
      persistedTransaction = await givenTransactionInstance(transactionRepository);
    });

    it('gets a transaction by ID', async () => {
      const result = await client
        .get(`/transactions/${persistedTransaction.id}`)
        .send()
        .expect(200);
      const expected = toJSON(persistedTransaction);

      expect(result.body).to.deepEqual(expected);
    });

    it('returns 404 when getting a transaction that does not exist', () => {
      return client.get('/transaction/99999').expect(404);
    });

    it('deletes the transaction', async () => {
      await client.del(`/transactions/${persistedTransaction.id}`).send().expect(204);
      await expect(transactionRepository.findById(persistedTransaction.id)).to.be.rejectedWith(
        EntityNotFoundError,
      );
    });

    it('returns 404 when deleting a transaction that does not exist', async () => {
      await client.del(`/transactions/99999`).expect(404);
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
      await transactionRepository.deleteAll();
    });

    beforeEach(async () => {
      persistedTransactions = [
        await givenTransactionInstance(transactionRepository, {from: user.id}),
        await givenTransactionInstance(transactionRepository, {from: otherUser.id}),
      ];
    });

    it('finds all transactions', async () => {
      const response = await client.get('/transactions').send().expect(200);
      expect(response.body.data).to.containDeep(persistedTransactions);
    });

    it('queries transactions with a filter', async () => {
      const transactionInProgress = await givenTransactionInstance(transactionRepository, {
        from: user.id,
        to: otherUser.id,
      });

      const response = await client
        .get('/transactions')
        .query(
          JSON.stringify({
            filter: {
              where: {from: user.id, to: otherUser.id},
            },
          }) + '&pageLimit=1',
        )
        .expect(200);

      expect(response.body.data).to.containDeep([toJSON(transactionInProgress)]);
    });

    it('exploded filter conditions work', async () => {
      await givenTransactionInstance(transactionRepository);

      const response = await client.get('/transactions').query('pageLimit=2');

      expect(response.body.data).to.have.length(2);
    });
  });

  it('includes fromUser, toUser, post, and currency in query result', async () => {
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
      .query(
        JSON.stringify({
          filter: {
            include: ['fromUser', 'toUser', 'currency'],
          },
        }) + '&pageLimit=1',
      )
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

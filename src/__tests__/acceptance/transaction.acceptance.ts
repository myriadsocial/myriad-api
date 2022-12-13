import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {Currency, Network, Transaction, User, Wallet} from '../../models';
import {
  CurrencyRepository,
  NetworkRepository,
  TransactionRepository,
  UserRepository,
  WalletRepository,
} from '../../repositories';
import {
  deleteAllRepository,
  givenAccesToken,
  givenCurrencyInstance,
  givenCurrencyRepository,
  givenNetworkInstance,
  givenNetworkRepository,
  givenOtherUser,
  givenTransaction,
  givenTransactionInstance,
  givenTransactionRepository,
  givenUserInstance,
  givenUserRepository,
  givenWalletInstance,
  givenWalletRepository,
  setupApplication,
} from '../helpers';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('TransactionApplication', function () {
  this.timeout(50000);

  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let userRepository: UserRepository;
  let currencyRepository: CurrencyRepository;
  let networkRepository: NetworkRepository;
  let transactionRepository: TransactionRepository;
  let walletRepository: WalletRepository;
  let currency: Currency;
  let user: User;
  let anotherUser: User;
  let wallet: Wallet;
  let otherWallet: Wallet;
  let network: Network;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    userRepository = await givenUserRepository(app);
    currencyRepository = await givenCurrencyRepository(app);
    transactionRepository = await givenTransactionRepository(app);
    walletRepository = await givenWalletRepository(app);
    networkRepository = await givenNetworkRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    anotherUser = await givenUserInstance(userRepository, givenOtherUser());
    wallet = await givenWalletInstance(walletRepository, {
      id: '0xd88ceaa9fa037f70ed640d936ba18f0c7127b43a3baf41695beb2f2f8d876862',
      userId: user.id,
    });
    otherWallet = await givenWalletInstance(walletRepository, {
      id: '0xe2211029a6d4ba27813511b2d2f4b0c675685c3cceca643b152159872108d93c',
      userId: anotherUser.id,
    });
    token = await givenAccesToken(user);
  });

  before(async () => {
    network = await givenNetworkInstance(networkRepository, {
      id: 'myriad',
      image:
        'https://pbs.twimg.com/profile_images/1407599051579617281/-jHXi6y5_400x400.jpg',
      rpcURL: 'wss://ws-rpc.testnet.myriad.social',
      explorerURL:
        'https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Fws-rpc.testnet.myriad.social#/explorer/query',
      blockchainPlatform: 'substrate',
    });
    currency = await givenCurrencyInstance(currencyRepository, {
      name: 'myria',
      symbol: 'MYRIA',
      decimal: 18,
      image: 'https://image.com/myria.svg',
      native: true,
      exchangeRate: false,
      networkId: network.id,
    });
  });

  after(async () => {
    await deleteAllRepository(app);
  });

  beforeEach(async () => {
    await transactionRepository.deleteAll();
  });

  it('creates a transaction', async function () {
    const transaction = givenTransaction({
      hash: '0xbdca73b63fd7cc0ea023ce9e680f0a8be39a9b2e43de54f1688b65912ce67b16',
      from: wallet.id,
      currencyId: currency.id,
      to: otherWallet.id,
      amount: 0.1,
    });
    const response = await client
      .post('/user/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(transaction)
      .expect(200);
    expect(response.body).to.containDeep({
      ...transaction,
      from: user.id,
      to: anotherUser.id,
    });
    const result = await transactionRepository.findById(response.body.id);
    expect(result).to.containDeep({
      ...transaction,
      from: user.id,
      to: anotherUser.id,
    });
  });

  it('returns 422 when create transactions but "currency" not exist', async () => {
    const transaction = givenTransaction({
      from: wallet.id,
    });

    await client
      .post('/user/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send(transaction)
      .expect(422);
  });

  context('when dealing with multiple persisted transactions', () => {
    let persistedTransactions: Transaction[];

    beforeEach(async () => {
      persistedTransactions = await Promise.all([
        givenTransactionInstance(transactionRepository, {
          from: user.id,
          currencyId: currency.id,
        }),
        givenTransactionInstance(transactionRepository, {
          from: user.id,
          currencyId: currency.id,
          amount: 10,
        }),
      ]);
    });

    it('finds all transactions', async () => {
      const response = await client
        .get('/user/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      expect(response.body.data).to.containDeep(toJSON(persistedTransactions));
    });

    it('exploded filter conditions work', async () => {
      await givenTransactionInstance(transactionRepository, {
        currencyId: currency.id,
      });

      const response = await client
        .get('/user/transactions')
        .set('Authorization', `Bearer ${token}`)
        .query('pageLimit=2');

      expect(response.body.data).to.have.length(2);
    });
  });

  it('includes fromUser, toUser, and currency in query result', async () => {
    const otherUser = await givenUserInstance(userRepository, {
      name: 'husni',
    });
    await givenWalletInstance(walletRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61811',
      userId: otherUser.id,
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      from: user.id,
      to: otherUser.id,
      currencyId: currency.id,
    });

    const response = await client
      .get('/user/transactions')
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

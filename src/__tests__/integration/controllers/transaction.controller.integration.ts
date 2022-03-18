import {expect} from '@loopback/testlab';
import {TransactionController} from '../../../controllers';
import {
  TransactionRepository,
  UserRepository,
  WalletRepository,
  CurrencyRepository,
} from '../../../repositories';
import {NotificationService} from '../../../services';
import {
  givenCurrencyInstance,
  givenEmptyDatabase,
  givenRepositories,
  givenTransactionInstance,
  givenUserInstance,
  givenWalletInstance,
  testdb,
} from '../../helpers';

describe('TransactionControllerIntegration', () => {
  let transactionRepository: TransactionRepository;
  let userRepository: UserRepository;
  let walletRepository: WalletRepository;
  let notificationService: NotificationService;
  let currencyRepository: CurrencyRepository;
  let controller: TransactionController;

  before(async () => {
    ({
      transactionRepository,
      userRepository,
      walletRepository,
      currencyRepository,
      notificationService,
    } = await givenRepositories(testdb));
  });

  before(async () => {
    controller = new TransactionController(
      transactionRepository,
      notificationService,
    );
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes fromWallet in find method result', async () => {
    const user = await givenUserInstance(userRepository);
    const currency = await givenCurrencyInstance(currencyRepository);
    const wallet = await givenWalletInstance(walletRepository, {
      userId: user.id,
    });

    const transaction = await givenTransactionInstance(transactionRepository, {
      from: wallet.id,
      to: '9999',
      currencyId: currency.id,
    });

    const response = await controller.find({include: ['fromWallet']});

    expect(response).to.containDeep([
      {
        ...transaction,
        fromWallet: wallet,
      },
    ]);
  });

  it('includes toWallet in find method result', async () => {
    const user = await givenUserInstance(userRepository);
    const currency = await givenCurrencyInstance(currencyRepository);
    const wallet = await givenWalletInstance(walletRepository, {
      userId: user.id,
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      to: wallet.id,
      from: '9999',
      currencyId: currency.id,
    });
    const response = await controller.find({include: ['toWallet']});

    expect(response).to.containDeep([
      {
        ...transaction,
        toWallet: wallet,
      },
    ]);
  });

  it('includes both fromWallet and toWallet in find method result', async () => {
    const user = await givenUserInstance(userRepository);
    const currency = await givenCurrencyInstance(currencyRepository);
    const otherUser = await givenUserInstance(userRepository, {
      username: 'johndoe',
    });
    const fromWallet = await givenWalletInstance(walletRepository, {
      userId: user.id,
    });
    const toWallet = await givenWalletInstance(walletRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
      userId: otherUser.id,
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      from: fromWallet.id,
      to: toWallet.id,
      currencyId: currency.id,
    });
    const response = await controller.find({
      include: ['fromWallet', 'toWallet'],
    });

    expect(response).to.containDeep([
      {
        ...transaction,
        fromWallet: fromWallet,
        toWallet: toWallet,
      },
    ]);
  });

  it('includes fromWallet in findById method result', async () => {
    const user = await givenUserInstance(userRepository);
    const wallet = await givenWalletInstance(walletRepository, {
      userId: user.id,
    });
    const currency = await givenCurrencyInstance(currencyRepository);
    const transaction = await givenTransactionInstance(transactionRepository, {
      from: wallet.id,
      to: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
      currencyId: currency.id,
    });

    const response = await controller.findById(transaction.id ?? '', {
      include: ['fromWallet'],
    });

    expect(response).to.containDeep({
      ...transaction,
      fromWallet: wallet,
    });
  });

  it('includes toWallet in findById method result', async () => {
    const user = await givenUserInstance(userRepository);
    const wallet = await givenWalletInstance(walletRepository, {
      userId: user.id,
    });
    const currency = await givenCurrencyInstance(currencyRepository);
    const transaction = await givenTransactionInstance(transactionRepository, {
      to: wallet.id,
      from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
      currencyId: currency.id,
    });

    const response = await controller.findById(transaction.id ?? '', {
      include: ['toWallet'],
    });

    expect(response).to.containDeep({
      ...transaction,
      toWallet: wallet,
    });
  });

  it('includes both fromWallet and toWallet in findById method result', async () => {
    const user = await givenUserInstance(userRepository);
    const currency = await givenCurrencyInstance(currencyRepository);
    const otherUser = await givenUserInstance(userRepository, {
      username: '9999',
    });
    const fromWallet = await givenWalletInstance(walletRepository, {
      userId: user.id,
    });
    const toWallet = await givenWalletInstance(walletRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
      userId: otherUser.id,
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      from: fromWallet.id,
      to: toWallet.id,
      currencyId: currency.id,
    });
    const response = await controller.findById(transaction.id ?? '', {
      include: ['fromWallet', 'toWallet'],
    });

    expect(response).to.containDeep({
      ...transaction,
      fromWallet: fromWallet,
      toWallet: toWallet,
    });
  });
});

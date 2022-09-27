import {expect} from '@loopback/testlab';
import {TransactionController} from '../../../controllers';
import {
  TransactionRepository,
  UserRepository,
  WalletRepository,
  CurrencyRepository,
  UserSocialMediaRepository,
} from '../../../repositories';
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
  let userSocialMediaRepository: UserSocialMediaRepository;
  let userRepository: UserRepository;
  let walletRepository: WalletRepository;
  let currencyRepository: CurrencyRepository;
  let controller: TransactionController;

  before(async () => {
    ({
      transactionRepository,
      userRepository,
      walletRepository,
      currencyRepository,
    } = await givenRepositories(testdb));
  });

  before(async () => {
    controller = new TransactionController(
      transactionRepository,
      userSocialMediaRepository,
    );
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes fromWallet in find method result', async () => {
    const user = await givenUserInstance(userRepository);
    const currency = await givenCurrencyInstance(currencyRepository);

    await givenWalletInstance(walletRepository, {
      userId: user.id,
    });

    const transaction = await givenTransactionInstance(transactionRepository, {
      from: user.id,
      to: '9999',
      currencyId: currency.id,
    });

    const response = await controller.find({include: ['fromUser']});

    expect(response).to.containDeep([
      {
        ...transaction,
        fromUser: user,
      },
    ]);
  });

  it('includes toWallet in find method result', async () => {
    const user = await givenUserInstance(userRepository);
    const currency = await givenCurrencyInstance(currencyRepository);

    await givenWalletInstance(walletRepository, {
      userId: user.id,
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      to: user.id,
      from: '9999',
      currencyId: currency.id,
    });
    const response = await controller.find({include: ['toUser']});

    expect(response).to.containDeep([
      {
        ...transaction,
        toUser: user,
      },
    ]);
  });

  it('includes both fromWallet and toWallet in find method result', async () => {
    const user = await givenUserInstance(userRepository);
    const currency = await givenCurrencyInstance(currencyRepository);
    const otherUser = await givenUserInstance(userRepository, {
      username: 'johndoe',
    });
    await givenWalletInstance(walletRepository, {
      userId: user.id,
    });
    await givenWalletInstance(walletRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
      userId: otherUser.id,
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      from: user.id,
      to: otherUser.id,
      currencyId: currency.id,
    });
    const response = await controller.find({
      include: ['fromUser', 'toUser'],
    });

    expect(response).to.containDeep([
      {
        ...transaction,
        fromUser: user,
        toUser: otherUser,
      },
    ]);
  });

  it('includes fromWallet in findById method result', async () => {
    const user = await givenUserInstance(userRepository);
    await givenWalletInstance(walletRepository, {
      userId: user.id,
    });
    const currency = await givenCurrencyInstance(currencyRepository);
    const transaction = await givenTransactionInstance(transactionRepository, {
      from: user.id,
      to: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
      currencyId: currency.id,
    });

    const response = await controller.findById(transaction.id ?? '', {
      include: ['fromUser'],
    });

    expect(response).to.containDeep({
      ...transaction,
      fromUser: user,
    });
  });

  it('includes toWallet in findById method result', async () => {
    const user = await givenUserInstance(userRepository);
    await givenWalletInstance(walletRepository, {
      userId: user.id,
    });
    const currency = await givenCurrencyInstance(currencyRepository);
    const transaction = await givenTransactionInstance(transactionRepository, {
      to: user.id,
      from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
      currencyId: currency.id,
    });

    const response = await controller.findById(transaction.id ?? '', {
      include: ['toUser'],
    });

    expect(response).to.containDeep({
      ...transaction,
      toUser: user,
    });
  });

  it('includes both fromWallet and toWallet in findById method result', async () => {
    const user = await givenUserInstance(userRepository);
    const currency = await givenCurrencyInstance(currencyRepository);
    const otherUser = await givenUserInstance(userRepository, {
      username: '9999',
    });
    await givenWalletInstance(walletRepository, {
      userId: user.id,
    });
    await givenWalletInstance(walletRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
      userId: otherUser.id,
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      from: user.id,
      to: otherUser.id,
      currencyId: currency.id,
    });
    const response = await controller.findById(transaction.id ?? '', {
      include: ['fromUser', 'toUser'],
    });

    expect(response).to.containDeep({
      ...transaction,
      fromUser: user,
      toUser: otherUser,
    });
  });
});

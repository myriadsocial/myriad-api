import {expect} from '@loopback/testlab';
import {UserTransactionController} from '../../../controllers';
import {
  TransactionRepository,
  UserRepository,
  WalletRepository,
  CurrencyRepository,
} from '../../../repositories';
import {UserService} from '../../../services';
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
  let currencyRepository: CurrencyRepository;
  let userService: UserService;
  let controller: UserTransactionController;

  before(async () => {
    ({
      transactionRepository,
      userRepository,
      walletRepository,
      currencyRepository,
      userService,
    } = await givenRepositories(testdb));
  });

  before(async () => {
    controller = new UserTransactionController(userService);
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
});

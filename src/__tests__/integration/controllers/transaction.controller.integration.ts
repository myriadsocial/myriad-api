import {expect} from '@loopback/testlab';
import {TransactionController} from '../../../controllers';
import {TransactionRepository, UserRepository} from '../../../repositories';
import {NotificationService} from '../../../services';
import {
  givenEmptyDatabase,
  givenRepositories,
  givenTransactionInstance,
  givenUserInstance,
  testdb,
} from '../../helpers';

describe('TransactionControllerIntegration', () => {
  let transactionRepository: TransactionRepository;
  let userRepository: UserRepository;
  let notificationService: NotificationService;
  let controller: TransactionController;

  before(async () => {
    ({transactionRepository, userRepository, notificationService} =
      await givenRepositories(testdb));
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

  it('includes fromUser in find method result', async () => {
    const user = await givenUserInstance(userRepository);

    const transaction = await givenTransactionInstance(transactionRepository, {
      from: user.id,
      to: '9999',
    });

    const response = await controller.find({include: ['fromUser']});

    expect(response).to.containDeep([
      {
        ...transaction,
        fromUser: user,
      },
    ]);
  });

  it('includes toUser in find method result', async () => {
    const user = await givenUserInstance(userRepository);
    const transaction = await givenTransactionInstance(transactionRepository, {
      to: user.id,
      from: '9999',
    });
    const response = await controller.find({include: ['toUser']});

    expect(response).to.containDeep([
      {
        ...transaction,
        toUser: user,
      },
    ]);
  });

  it('includes both fromUser and toUser in find method result', async () => {
    const user = await givenUserInstance(userRepository);
    const otherUser = await givenUserInstance(userRepository, {
      username: 'johndoe',
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      from: user.id,
      to: otherUser.id,
    });
    const response = await controller.find({include: ['fromUser', 'toUser']});

    expect(response).to.containDeep([
      {
        ...transaction,
        fromUser: user,
        toUser: otherUser,
      },
    ]);
  });

  it('includes fromUser in findById method result', async () => {
    const user = await givenUserInstance(userRepository);

    const transaction = await givenTransactionInstance(transactionRepository, {
      from: user.id,
      to: '9999',
    });

    const response = await controller.findById(transaction.id ?? '', {
      include: ['fromUser'],
    });

    expect(response).to.containDeep({
      ...transaction,
      fromUser: user,
    });
  });

  it('includes toUser in findById method result', async () => {
    const user = await givenUserInstance(userRepository);
    const transaction = await givenTransactionInstance(transactionRepository, {
      to: user.id,
      from: '9999',
    });

    const response = await controller.findById(transaction.id ?? '', {
      include: ['toUser'],
    });

    expect(response).to.containDeep({
      ...transaction,
      toUser: user,
    });
  });

  it('includes both fromUser and toUser in findById method result', async () => {
    const user = await givenUserInstance(userRepository);
    const otherUser = await givenUserInstance(userRepository, {
      username: '9999',
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      from: user.id,
      to: otherUser.id,
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

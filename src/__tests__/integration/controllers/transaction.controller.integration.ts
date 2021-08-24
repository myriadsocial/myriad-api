import {expect} from '@loopback/testlab';
import {TransactionController} from '../../../controllers';
import {TransactionRepository, UserRepository} from '../../../repositories';
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
  let controller: TransactionController;

  before(async () => {
    ({transactionRepository, userRepository} = await givenRepositories(testdb));
  });

  before(async () => {
    controller = new TransactionController(transactionRepository);
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes fromUser in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });

    const transaction = await givenTransactionInstance(transactionRepository, {
      from: user.id,
      to: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
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
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      to: user.id,
      from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
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
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
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
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });

    const transaction = await givenTransactionInstance(transactionRepository, {
      from: user.id,
      to: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });

    const response = await controller.findById(transaction.id ?? '', {include: ['fromUser']});

    expect(response).to.containDeep({
      ...transaction,
      fromUser: user,
    });
  });

  it('includes toUser in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      to: user.id,
      from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });

    const response = await controller.findById(transaction.id ?? '', {include: ['toUser']});

    expect(response).to.containDeep({
      ...transaction,
      toUser: user,
    });
  });

  it('includes both fromUser and toUser in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
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

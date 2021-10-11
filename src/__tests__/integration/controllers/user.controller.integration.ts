import {expect, toJSON} from '@loopback/testlab';
import {UserController} from '../../../controllers';
import {ActivityLogType} from '../../../enums';
import {
  ActivityLogRepository,
  CurrencyRepository,
  FriendRepository,
  UserCurrencyRepository,
  UserRepository,
} from '../../../repositories';
import {User} from '../../../models';
import {
  givenActivityLogInstance,
  givenCurrencyInstance,
  givenEmptyDatabase,
  givenFriendInstance,
  givenRepositories,
  givenUserCurrencyInstance,
  givenUserInstance,
  testdb,
} from '../../helpers';

describe('UserControllerIntegration', () => {
  let userRepository: UserRepository;
  let userCurrencyRepository: UserCurrencyRepository;
  let activityLogRepository: ActivityLogRepository;
  let currencyRepository: CurrencyRepository;
  let friendRepository: FriendRepository;
  let controller: UserController;

  before(async () => {
    ({
      userRepository,
      userCurrencyRepository,
      currencyRepository,
      friendRepository,
      activityLogRepository,
    } = await givenRepositories(testdb));
  });

  before(async () => {
    controller = new UserController(userRepository, activityLogRepository);
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes Currencies in find method result', async () => {
    const currency = await givenCurrencyInstance(currencyRepository);
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });

    await givenUserCurrencyInstance(userCurrencyRepository, {
      userId: user.id,
      currencyId: currency.id,
    });

    const response = await controller.find({include: ['currencies']});

    expect(response).to.containDeep([
      {
        ...user,
        currencies: [currency],
      },
    ]);
  });

  it('includes Friends in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618gl',
    });
    const friend = await givenFriendInstance(friendRepository, {
      requestorId: otherUser.id,
      requesteeId: user.id,
    });
    const response = await controller.find({include: ['friends']});

    expect(response).to.containDeep([
      {
        ...user,
        friends: [friend],
      },
    ]);
  });

  it('includes Activity Log in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const activityLog = await givenActivityLogInstance(activityLogRepository, {
      userId: user.id,
    });
    const response = await controller.find({include: ['activityLogs']});

    expect(response).to.containDeep([
      {
        ...user,
        activityLogs: [activityLog],
      },
    ]);
  });

  it('includes Currencies, ActivityLogs and Friends in find method result', async () => {
    const currency = await givenCurrencyInstance(currencyRepository);
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618gl',
    });
    const activityLog = await givenActivityLogInstance(activityLogRepository, {
      userId: user.id,
    });
    const friend = await givenFriendInstance(friendRepository, {
      requestorId: otherUser.id,
      requesteeId: user.id,
    });

    await givenUserCurrencyInstance(userCurrencyRepository, {
      userId: user.id,
      currencyId: currency.id,
    });

    const response = await controller.find({
      include: ['currencies', 'friends', 'activityLogs'],
    });

    expect(response).to.containDeep([
      {
        ...user,
        currencies: [currency],
        friends: [friend],
        activityLogs: [activityLog],
      },
    ]);
  });

  it('includes Currencies in findById method result', async () => {
    const currency = await givenCurrencyInstance(currencyRepository);
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });

    await givenUserCurrencyInstance(userCurrencyRepository, {
      userId: user.id,
      currencyId: currency.id,
    });

    const response = await controller.findById(user.id, {
      include: ['currencies'],
    });

    expect(response).to.containDeep({
      ...user,
      currencies: [currency],
    });
  });

  it('includes Friends in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618gl',
    });
    const friend = await givenFriendInstance(friendRepository, {
      requestorId: otherUser.id,
      requesteeId: user.id,
    });
    const response = await controller.findById(user.id, {include: ['friends']});

    expect(response).to.containDeep({
      ...user,
      friends: [friend],
    });
  });

  it('includes ActivityLog in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });

    const activityLog = await givenActivityLogInstance(activityLogRepository, {
      userId: user.id,
    });

    const response = await controller.findById(user.id, {
      include: ['activityLogs'],
    });

    expect(response).to.containDeep({
      ...user,
      activityLogs: [activityLog],
    });
  });

  it('includes Currencies, ActivityLogs, and Friends in findById method result', async () => {
    const currency = await givenCurrencyInstance(currencyRepository);
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618gl',
    });
    const friend = await givenFriendInstance(friendRepository, {
      requestorId: otherUser.id,
      requesteeId: user.id,
    });
    const activityLog = await givenActivityLogInstance(activityLogRepository, {
      userId: user.id,
    });

    await givenUserCurrencyInstance(userCurrencyRepository, {
      userId: user.id,
      currencyId: currency.id,
    });

    const response = await controller.findById(user.id, {
      include: ['currencies', 'friends', 'activityLogs'],
    });

    expect(response).to.containDeep({
      ...user,
      currencies: [currency],
      friends: [friend],
      activityLogs: [activityLog],
    });
  });

  it('creates activity logs when user updating username', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      username: 'abdulhakim01',
    });

    await controller.updateById(user.id, {
      username: 'abdulhakim10',
    });

    const activityLogs = await activityLogRepository.find({
      where: {
        type: ActivityLogType.USERNAME,
        userId: user.id,
      },
    });

    delete activityLogs[0].id;

    expect({
      type: ActivityLogType.USERNAME,
      userId: user.id,
      message: 'You updated your username',
    }).to.containEql(toJSON(activityLogs[0]));
  });

  it('creates data in UserRepository when creating user', async () => {
    const user = new User({
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bd',
      name: 'ex irure',
      username: 'dolor nostrud id laborum',
      bio: 'mollit Duis est Excepteur',
    });

    const response = await controller.create(user);

    const savedUser = await userRepository.findOne({
      where: {
        id: user.id,
      },
    });

    //check that a password has been generated
    expect(savedUser).to.have.property('password');
    expect(savedUser?.password).not.equal(null);
    expect(response).to.have.property('password');
    expect(response?.password).not.equal(null);
  });
});

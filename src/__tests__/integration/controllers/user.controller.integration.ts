import {expect} from '@loopback/testlab';
import {UserController} from '../../../controllers';
import {
  ActivityLogRepository,
  CurrencyRepository,
  FriendRepository,
  UserCurrencyRepository,
  UserRepository,
} from '../../../repositories';
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
    controller = new UserController(userRepository);
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes Currencies in find method result', async () => {
    const currency = await givenCurrencyInstance(currencyRepository);
    const user = await givenUserInstance(userRepository);

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
    const user = await givenUserInstance(userRepository);
    const otherUser = await givenUserInstance(userRepository, {
      username: 'johndoe',
    });
    const friend = await givenFriendInstance(friendRepository, {
      requestorId: user.id,
      requesteeId: otherUser.id,
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
    const user = await givenUserInstance(userRepository);
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
    const user = await givenUserInstance(userRepository);
    const otherUser = await givenUserInstance(userRepository, {
      username: 'johndoe',
    });
    const activityLog = await givenActivityLogInstance(activityLogRepository, {
      userId: user.id,
    });
    const friend = await givenFriendInstance(friendRepository, {
      requestorId: user.id,
      requesteeId: otherUser.id,
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
    const user = await givenUserInstance(userRepository);

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
    const user = await givenUserInstance(userRepository);
    const otherUser = await givenUserInstance(userRepository, {
      username: 'johndoe',
    });
    const friend = await givenFriendInstance(friendRepository, {
      requestorId: user.id,
      requesteeId: otherUser.id,
    });
    const response = await controller.findById(user.id, {include: ['friends']});

    expect(response).to.containDeep({
      ...user,
      friends: [friend],
    });
  });

  it('includes ActivityLog in findById method result', async () => {
    const user = await givenUserInstance(userRepository);

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
    const user = await givenUserInstance(userRepository);
    const otherUser = await givenUserInstance(userRepository, {
      username: 'johndoe',
    });
    const friend = await givenFriendInstance(friendRepository, {
      requestorId: user.id,
      requesteeId: otherUser.id,
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
});

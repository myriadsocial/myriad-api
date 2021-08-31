import {expect, toJSON} from '@loopback/testlab';
import {UserController} from '../../../controllers';
import {ActivityLogType} from '../../../enums';
import {
  ActivityRepository,
  CurrencyRepository,
  FriendRepository,
  UserCurrencyRepository,
  UserRepository,
} from '../../../repositories';
import {
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
  let activityRepository: ActivityRepository;
  let currencyRepository: CurrencyRepository;
  let friendRepository: FriendRepository;
  let controller: UserController;

  before(async () => {
    ({
      userRepository,
      userCurrencyRepository,
      currencyRepository,
      friendRepository,
      activityRepository,
    } = await givenRepositories(testdb));
  });

  before(async () => {
    controller = new UserController(userRepository, activityRepository);
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

  it('includes both Currencies and Friends in find method result', async () => {
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

    await givenUserCurrencyInstance(userCurrencyRepository, {
      userId: user.id,
      currencyId: currency.id,
    });

    const response = await controller.find({include: ['currencies', 'friends']});

    expect(response).to.containDeep([
      {
        ...user,
        currencies: [currency],
        friends: [friend],
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

    const response = await controller.findById(user.id, {include: ['currencies']});

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

  it('includes both Currencies and Friends in findById method result', async () => {
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

    await givenUserCurrencyInstance(userCurrencyRepository, {
      userId: user.id,
      currencyId: currency.id,
    });

    const response = await controller.findById(user.id, {include: ['currencies', 'friends']});

    expect(response).to.containDeep({
      ...user,
      currencies: [currency],
      friends: [friend],
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

    const activities = await activityRepository.find({
      where: {
        type: ActivityLogType.USERNAME,
        userId: user.id,
      },
    });

    expect({
      id: '1',
      type: ActivityLogType.USERNAME,
      userId: user.id,
      message: 'You updated your username',
    }).to.containEql(toJSON(activities[0]));
  });
});

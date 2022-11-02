import {expect} from '@loopback/testlab';
import {UserController} from '../../../controllers';
import {
  ActivityLogRepository,
  FriendRepository,
  UserRepository,
} from '../../../repositories';
import {UserService} from '../../../services';
import {
  givenActivityLogInstance,
  givenEmptyDatabase,
  givenFriendInstance,
  givenRepositories,
  givenUserInstance,
  testdb,
} from '../../helpers';

describe('UserControllerIntegration', () => {
  let userRepository: UserRepository;
  let activityLogRepository: ActivityLogRepository;
  let friendRepository: FriendRepository;
  let userService: UserService;
  let controller: UserController;

  before(async () => {
    ({userRepository, friendRepository, activityLogRepository, userService} =
      await givenRepositories(testdb));
  });

  before(async () => {
    controller = new UserController(userService);
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
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

  it('includes ActivityLogs and Friends in find method result', async () => {
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

    const response = await controller.find({
      include: ['friends', 'activityLogs'],
    });

    expect(response).to.containDeep([
      {
        ...user,
        friends: [friend],
        activityLogs: [activityLog],
      },
    ]);
  });
});

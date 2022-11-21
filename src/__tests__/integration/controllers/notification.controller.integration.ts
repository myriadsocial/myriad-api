import {expect} from '@loopback/testlab';
import {UserNotificationController} from '../../../controllers';
import {NotificationRepository, UserRepository} from '../../../repositories';
import {UserService} from '../../../services';
import {
  givenEmptyDatabase,
  givenNotificationInstance,
  givenRepositories,
  givenUserInstance,
  testdb,
} from '../../helpers';

describe('NotificationControllerIntegration', () => {
  let userRepository: UserRepository;
  let notificationRepository: NotificationRepository;
  let userService: UserService;
  let controller: UserNotificationController;

  before(async () => {
    ({userRepository, notificationRepository, userService} =
      await givenRepositories(testdb));
  });

  before(async () => {
    controller = new UserNotificationController(userService);
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes fromUserId in find method result', async () => {
    const user = await givenUserInstance(userRepository);

    const notification = await givenNotificationInstance(
      notificationRepository,
      {
        from: user.id,
        to: '9999',
      },
    );

    const response = await controller.find({include: ['fromUserId']});

    expect(response).to.containDeep([
      {
        ...notification,
        fromUserId: user,
      },
    ]);
  });

  it('includes toUserId in find method result', async () => {
    const user = await givenUserInstance(userRepository);
    const notification = await givenNotificationInstance(
      notificationRepository,
      {
        to: user.id,
        from: '9999',
      },
    );
    const response = await controller.find({include: ['toUserId']});

    expect(response).to.containDeep([
      {
        ...notification,
        toUserId: user,
      },
    ]);
  });

  it('includes both fromUserId and toUserId in find method result', async () => {
    const user = await givenUserInstance(userRepository);
    const otherUser = await givenUserInstance(userRepository, {
      username: 'johndoe',
    });
    const notification = await givenNotificationInstance(
      notificationRepository,
      {
        from: user.id,
        to: otherUser.id,
      },
    );
    const response = await controller.find({
      include: ['fromUserId', 'toUserId'],
    });

    expect(response).to.containDeep([
      {
        ...notification,
        fromUserId: user,
        toUserId: otherUser,
      },
    ]);
  });
});

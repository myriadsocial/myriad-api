import {expect} from '@loopback/testlab';
import {NotificationController} from '../../../controllers';
import {NotificationRepository, UserRepository} from '../../../repositories';
import {
  givenEmptyDatabase,
  givenNotificationInstance,
  givenRepositories,
  givenUserInstance,
} from '../../helpers';

describe('NotificationControllerIntegration', () => {
  let userRepository: UserRepository;
  let notificationRepository: NotificationRepository;
  let controller: NotificationController;

  before(async () => {
    ({userRepository, notificationRepository} = await givenRepositories());
  });

  before(async () => {
    controller = new NotificationController(notificationRepository);
  });

  beforeEach(givenEmptyDatabase);

  it('includes fromUserId in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });

    const notification = await givenNotificationInstance(notificationRepository, {
      from: user.id,
      to: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });

    const response = await controller.find({include: ['fromUserId']});

    expect(response).to.containDeep([
      {
        ...notification,
        fromUserId: user,
      },
    ]);
  });

  it('includes toUserId in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const notification = await givenNotificationInstance(notificationRepository, {
      to: user.id,
      from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });
    const response = await controller.find({include: ['toUserId']});

    expect(response).to.containDeep([
      {
        ...notification,
        toUserId: user,
      },
    ]);
  });

  it('includes both fromUserId and toUserId in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });
    const notification = await givenNotificationInstance(notificationRepository, {
      from: user.id,
      to: otherUser.id,
    });
    const response = await controller.find({include: ['fromUserId', 'toUserId']});

    expect(response).to.containDeep([
      {
        ...notification,
        fromUserId: user,
        toUserId: otherUser,
      },
    ]);
  });

  it('includes fromUserId in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });

    const notification = await givenNotificationInstance(notificationRepository, {
      from: user.id,
      to: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });

    if (notification.id) {
      const response = await controller.findById(notification.id, {include: ['fromUserId']});

      expect(response).to.containDeep({
        ...notification,
        fromUserId: user,
      });
    }
  });

  it('includes toUserId in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const notification = await givenNotificationInstance(notificationRepository, {
      to: user.id,
      from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });

    if (notification.id) {
      const response = await controller.findById(notification.id, {include: ['toUserId']});

      expect(response).to.containDeep({
        ...notification,
        toUserId: user,
      });
    }
  });

  it('includes both fromUserId and toUserId in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });
    const notification = await givenNotificationInstance(notificationRepository, {
      from: user.id,
      to: otherUser.id,
    });

    if (notification.id) {
      const response = await controller.findById(notification.id, {
        include: ['fromUserId', 'toUserId'],
      });

      expect(response).to.containDeep({
        ...notification,
        fromUserId: user,
        toUserId: otherUser,
      });
    }
  });
});

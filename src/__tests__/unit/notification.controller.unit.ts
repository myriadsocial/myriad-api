import {
  createStubInstance,
  expect,
  sinon,
  StubbedInstanceWithSinonAccessor,
  toJSON,
} from '@loopback/testlab';
import {NotificationController} from '../../controllers';
import {NotificationType} from '../../enums';
import {Notification} from '../../models';
import {NotificationRepository} from '../../repositories';
import {givenNotification} from '../helpers';

describe('NotificationController', () => {
  let notificationRepository: StubbedInstanceWithSinonAccessor<NotificationRepository>;
  let controller: NotificationController;
  let aNotificationWithId: Notification;
  let aListOfNotifications: Notification[];

  beforeEach(resetRepositories);

  describe('findNotificationById', () => {
    it('returns a notification if it exists', async () => {
      const findById = notificationRepository.stubs.findById;
      findById.resolves(aNotificationWithId);
      expect(
        await controller.findById(aNotificationWithId.id as string),
      ).to.eql(aNotificationWithId);
      sinon.assert.calledWith(findById, aNotificationWithId.id);
    });
  });

  describe('findNotifications', () => {
    it('returns multiple notifications if they exist', async () => {
      const find = notificationRepository.stubs.find;
      find.resolves(aListOfNotifications);
      expect(await controller.find()).to.eql(aListOfNotifications);
      sinon.assert.called(find);
    });

    it('returns empty list if no notifications exist', async () => {
      const find = notificationRepository.stubs.find;
      const expected: Notification[] = [];
      find.resolves(expected);
      expect(await controller.find()).to.eql(expected);
      sinon.assert.called(find);
    });

    it('uses the provided filter', async () => {
      const find = notificationRepository.stubs.find;
      const filter = toJSON({
        where: {
          from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61866',
        },
      });

      find.resolves(aListOfNotifications);
      await controller.find(filter);
      sinon.assert.calledWith(find, filter);
    });
  });

  function resetRepositories() {
    notificationRepository = createStubInstance(NotificationRepository);
    aNotificationWithId = givenNotification({
      id: '1',
    });
    aListOfNotifications = [
      aNotificationWithId,
      givenNotification({
        id: '261',
        type: NotificationType.FRIEND_REQUEST,
        read: false,
        message: 'sent you friend request',
        referenceId:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61865',
        from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61866',
        to: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61865',
      }),
    ] as Notification[];

    controller = new NotificationController(notificationRepository);
  }
});

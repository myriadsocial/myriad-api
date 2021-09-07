import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {NotificationType} from '../../enums';
import {Notification} from '../../models';
import {NotificationRepository, UserRepository} from '../../repositories';
import {
  givenMultipleNotificationInstances,
  givenNotification,
  givenNotificationInstance,
  givenNotificationRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';

describe('NotificationApplication', function () {
  let app: MyriadApiApplication;
  let client: Client;
  let notificationRepository: NotificationRepository;
  let userRepository: UserRepository;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    notificationRepository = await givenNotificationRepository(app);
    userRepository = await givenUserRepository(app);
  });

  beforeEach(async () => {
    await notificationRepository.deleteAll();
    await userRepository.deleteAll();
  });

  context('when dealing with a single persisted notification', () => {
    let persistedNotification: Notification;

    beforeEach(async () => {
      persistedNotification = await givenNotificationInstance(
        notificationRepository,
      );
    });

    it('gets a notification by ID', async () => {
      const result = await client
        .get(`/notifications/${persistedNotification.id}`)
        .send()
        .expect(200);
      const expected = toJSON(persistedNotification);

      expect(result.body).to.deepEqual(expected);
    });

    it('gets a count of notification', async function () {
      await givenNotificationInstance(notificationRepository, {
        type: NotificationType.FRIEND_REQUEST,
        read: false,
        message: 'sent you friend request',
        referenceId:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61861',
        from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61862',
        to: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61861',
      });
      await client.get('/notifications/count').expect(200, {count: 2});
    });

    it('count notifications with a filter', async () => {
      await givenNotificationInstance(notificationRepository, {
        type: NotificationType.FRIEND_REQUEST,
        read: false,
        message: 'sent you friend request',
        referenceId:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61868',
        from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61869',
        to: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61868',
      });

      await client
        .get('/notifications/count')
        .query({
          where: {
            from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61869',
          },
        })
        .expect(200, {
          count: 1,
        });
    });

    it('returns 404 when getting a notification that does not exist', () => {
      return client.get('/notifications/99999').expect(404);
    });

    it('updates the notification by ID ', async () => {
      const updatedNotification = givenNotification({
        message: 'accept your friend request',
      });
      await client
        .patch(`/notifications/${persistedNotification.id}`)
        .send(updatedNotification)
        .expect(204);
      const result = await notificationRepository.findById(
        persistedNotification.id,
      );
      expect(result).to.containEql(updatedNotification);
    });

    it('returns 404 when updating a user that does not exist', () => {
      return client
        .patch('/notifications/99999')
        .send(givenNotification())
        .expect(404);
    });

    it('deletes the user', async () => {
      await client
        .del(`/notifications/${persistedNotification.id}`)
        .send()
        .expect(204);
      await expect(
        notificationRepository.findById(persistedNotification.id),
      ).to.be.rejectedWith(EntityNotFoundError);
    });

    it('returns 404 when deleting a user that does not exist', async () => {
      await client.del(`/notifications/99999`).expect(404);
    });
  });

  context('when dealing with multiple persisted notifications', () => {
    let persistedNotifications: Notification[];

    beforeEach(async () => {
      persistedNotifications = await givenMultipleNotificationInstances(
        notificationRepository,
      );
    });

    it('finds all notifications', async () => {
      const response = await client.get('/notifications').send().expect(200);
      expect(response.body.data).to.containDeep(toJSON(persistedNotifications));
    });

    it('queries notifications with a filter', async () => {
      const notificationInProgress = await givenNotificationInstance(
        notificationRepository,
        {
          type: NotificationType.FRIEND_REQUEST,
          read: false,
          message: 'sent you friend request',
          referenceId:
            '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61868',
          from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61869',
          to: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61868',
        },
      );

      await client
        .get('/notifications')
        .query(
          'filter=' +
            JSON.stringify({
              where: {
                from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61869',
              },
            }),
        )
        .expect(200, {
          data: [toJSON(notificationInProgress)],
          meta: {
            currentPage: 1,
            itemsPerPage: 1,
            totalItemCount: 1,
            totalPageCount: 1,
          },
        });
    });

    it('exploded filter conditions work', async () => {
      await givenNotificationInstance(notificationRepository, {
        type: NotificationType.FRIEND_REQUEST,
        read: false,
        message: 'sent you friend request',
        referenceId:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61860',
        from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61861',
        to: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61860',
      });

      const response = await client.get('/notifications').query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });

    it('includes fromUserId and toUserId in query result', async () => {
      const from = await givenUserInstance(userRepository, {
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61802',
        name: 'imam',
      });
      const to = await givenUserInstance(userRepository, {
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61801',
        name: 'muchtar',
      });
      const notification = await givenNotificationInstance(
        notificationRepository,
        {
          type: NotificationType.FRIEND_REQUEST,
          read: false,
          message: 'sent you friend request',
          referenceId:
            '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61801',
          from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61802',
          to: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61801',
        },
      );

      const filter =
        'filter=' +
        JSON.stringify({
          include: ['fromUserId', 'toUserId'],
          where: {id: notification.id},
        });

      const response = await client.get('/notifications').query(filter);

      expect(response.body.data).to.have.length(1);
      expect(response.body.data[0]).to.deepEqual({
        ...toJSON(notification),
        fromUserId: toJSON(from),
        toUserId: toJSON(to),
      });
    });
  });
});

import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {NotificationType} from '../../enums';
import {Notification, User} from '../../models';
import {NotificationRepository, UserRepository} from '../../repositories';
import {
  deleteAllRepository,
  givenAccesToken,
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
  let token: string;
  let client: Client;
  let notificationRepository: NotificationRepository;
  let userRepository: UserRepository;
  let user: User;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    notificationRepository = await givenNotificationRepository(app);
    userRepository = await givenUserRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    token = await givenAccesToken(user);
  });

  beforeEach(async () => {
    await notificationRepository.deleteAll();
  });

  after(async () => {
    await deleteAllRepository(app);
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
        .set('Authorization', `Bearer ${token}`)
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
        referenceId: '1',
        from: '2',
        to: '1',
      });
      await client
        .get('/notifications/count')
        .set('Authorization', `Bearer ${token}`)
        .expect(200, {count: 2});
    });

    it('count notifications with a filter', async () => {
      await givenNotificationInstance(notificationRepository, {
        type: NotificationType.FRIEND_REQUEST,
        read: false,
        message: 'sent you friend request',
        referenceId: '4',
        from: '3',
        to: '4',
      });

      await client
        .get('/notifications/count')
        .set('Authorization', `Bearer ${token}`)
        .query({
          where: {
            from: '3',
          },
        })
        .expect(200, {
          count: 1,
        });
    });

    it('returns 404 when getting a notification that does not exist', () => {
      return client
        .get('/notifications/99999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('returns 404 when updating a user that does not exist', () => {
      return client
        .patch('/notifications/99999')
        .set('Authorization', `Bearer ${token}`)
        .send(givenNotification())
        .expect(404);
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
      const response = await client
        .get('/notifications')
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      expect(response.body.data).to.containDeep(toJSON(persistedNotifications));
    });

    it('queries notifications with a filter', async () => {
      const notificationInProgress = await givenNotificationInstance(
        notificationRepository,
        {
          type: NotificationType.FRIEND_REQUEST,
          read: false,
          message: 'sent you friend request',
          referenceId: '5',
          from: '6',
          to: '5',
        },
      );

      await client
        .get('/notifications')
        .set('Authorization', `Bearer ${token}`)
        .query(
          'filter=' +
            JSON.stringify({
              where: {
                from: '6',
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
        referenceId: '7',
        from: '8',
        to: '7',
      });

      const response = await client
        .get('/notifications')
        .set('Authorization', `Bearer ${token}`)
        .query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });

    it('includes fromUserId and toUserId in query result', async () => {
      const from = await givenUserInstance(userRepository, {
        name: 'imam',
      });
      const to = await givenUserInstance(userRepository, {
        name: 'muchtar',
      });
      const notification = await givenNotificationInstance(
        notificationRepository,
        {
          type: NotificationType.FRIEND_REQUEST,
          read: false,
          message: 'sent you friend request',
          referenceId: to.id,
          from: from.id,
          to: to.id,
        },
      );

      const filter =
        'filter=' +
        JSON.stringify({
          include: ['fromUserId', 'toUserId'],
          where: {id: notification.id},
        });

      const response = await client
        .get('/notifications')
        .set('Authorization', `Bearer ${token}`)
        .query(filter);

      expect(response.body.data).to.have.length(1);
      expect(response.body.data[0]).to.deepEqual({
        ...toJSON(notification),
        fromUserId: toJSON(from),
        toUserId: toJSON(to),
      });
    });
  });
});

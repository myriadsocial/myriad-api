import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {FriendStatusType, NotificationType} from '../../enums';
import {Friend, User} from '../../models';
import {
  ActivityLogRepository,
  FriendRepository,
  NotificationRepository,
  UserRepository,
  WalletRepository,
} from '../../repositories';
import {
  deleteAllRepository,
  givenAccesToken,
  givenActivityLogRepository,
  givenFriend,
  givenFriendInstance,
  givenFriendRepository,
  givenNotificationRepository,
  givenUserInstance,
  givenUserRepository,
  givenWalletInstance,
  givenWalletRepository,
  setupApplication,
} from '../helpers';

/* eslint-disable  @typescript-eslint/no-invalid-this */
/* eslint-disable @typescript-eslint/no-misused-promises */
describe('FriendApplication', function () {
  this.timeout(50000);

  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let friendRepository: FriendRepository;
  let userRepository: UserRepository;
  let notificationRepository: NotificationRepository;
  let activityLogRepository: ActivityLogRepository;
  let walletRepository: WalletRepository;
  let user: User;
  let myriadOfficial: User;

  before(async () => {
    ({app, client} = await setupApplication(true));
  });

  after(() => app.stop());

  before(async () => {
    friendRepository = await givenFriendRepository(app);
    userRepository = await givenUserRepository(app);
    notificationRepository = await givenNotificationRepository(app);
    activityLogRepository = await givenActivityLogRepository(app);
    walletRepository = await givenWalletRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository, {fullAccess: true});
    token = await givenAccesToken(user);
    myriadOfficial = await givenUserInstance(userRepository, {
      name: 'Myriad Official',
      username: 'myriad_official',
    });

    await givenWalletInstance(walletRepository, {userId: user.id.toString()});
    await givenWalletInstance(walletRepository, {
      userId: myriadOfficial.id.toString(),
      id: '0x06cc7aa22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
    });
  });

  beforeEach(async () => {
    await friendRepository.deleteAll();
    await activityLogRepository.deleteAll();
  });

  after(async () => {
    await deleteAllRepository(app);
  });

  it('creates a pending friend request', async function () {
    const requestee = await givenUserInstance(userRepository, {
      username: 'johndoe',
    });

    const friend = givenFriend({
      requesteeId: requestee.id.toString(),
      requestorId: user.id.toString(),
    });

    const response = await client
      .post('/user/friends')
      .set('Authorization', `Bearer ${token}`)
      .send(friend)
      .expect(200);
    expect(response.body).to.containDeep(friend);
    const result = await friendRepository.findById(response.body.id);
    expect(result).to.containDeep(friend);
  });

  it('returns 401 when creates a pending request not as login user', async () => {
    const requestor = await givenUserInstance(userRepository, {
      username: 'johndoe',
    });
    const friend = givenFriend({
      requestorId: requestor.id,
      requesteeId: user.id,
    });

    await client
      .post('/user/friends')
      .set('Authorization', `Bearer ${token}`)
      .send(friend)
      .expect(401);
  });

  it('returns 422 when creates a pending friend request with no requesteeId/no requestorId', async () => {
    const friendWithNoRequesteeId = givenFriend({
      requestorId: '1',
    });

    await client
      .post('/user/friends')
      .set('Authorization', `Bearer ${token}`)
      .send(friendWithNoRequesteeId)
      .expect(422);

    const friendWithNoRequestorId = givenFriend({
      requesteeId: '1',
    });

    await client
      .post('/user/friends')
      .set('Authorization', `Bearer ${token}`)
      .send(friendWithNoRequestorId)
      .expect(422);
  });

  it('rejects requests to create a pending friend request with requesteeId equal requestorId', async () => {
    const friend: Partial<Friend> = givenFriend({
      requesteeId: user.id.toString(),
      requestorId: user.id.toString(),
    });

    await client
      .post('/user/friends')
      .set('Authorization', `Bearer ${token}`)
      .send(friend)
      .expect(422);
  });

  it('rejects requests to create a double pending friend request', async () => {
    const friend = givenFriend({
      requesteeId: '99999',
      requestorId: user.id,
    });
    await givenFriendInstance(friendRepository, {
      requesteeId: '99999',
      requestorId: user.id,
    });

    await client
      .post('/user/friends')
      .set('Authorization', `Bearer ${token}`)
      .send(friend)
      .expect(422);
  });

  it('rejects requests to create a pending friend request when already friend', async () => {
    const friend = givenFriend({
      requesteeId: '9999',
      requestorId: user.id,
    });
    await givenFriendInstance(friendRepository, {
      status: FriendStatusType.APPROVED,
      requesteeId: '9999',
      requestorId: user.id,
    });

    await client
      .post('/user/friends')
      .set('Authorization', `Bearer ${token}`)
      .send(friend)
      .expect(422);
  });

  context('when dealing with a single persisted friend', () => {
    it('updates the friend by ID ', async () => {
      const requestor = await givenUserInstance(userRepository, {
        username: 'black',
      });

      const friend = await givenFriendInstance(friendRepository, {
        requestorId: requestor.id,
        requesteeId: user.id,
      });

      const updatedFriend = givenFriend({
        status: FriendStatusType.APPROVED,
      });

      await client
        .patch(`/user/friends/${friend.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedFriend)
        .expect(204);

      const result = await friendRepository.findById(friend.id);
      expect(result).to.containEql(updatedFriend);
    });

    it('returns 401 when updating the friend by ID as not login user', async () => {
      const requestor = await givenUserInstance(userRepository, {
        username: 'kirania',
      });
      const requestee = await givenUserInstance(userRepository, {
        username: 'zahrani',
      });

      const friend = await givenFriendInstance(friendRepository, {
        requestorId: requestor.id,
        requesteeId: requestee.id,
      });

      const updatedFriend = givenFriend({
        status: FriendStatusType.APPROVED,
      });

      await client
        .patch(`/user/friends/${friend.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedFriend)
        .expect(401);
    });

    it('returns 404 when updating a friend that does not exist', () => {
      return client
        .patch('/user/friends/99999')
        .set('Authorization', `Bearer ${token}`)
        .send(
          givenFriend({
            status: FriendStatusType.APPROVED,
          }),
        )
        .expect(404);
    });

    it('deletes the friend', async () => {
      const requestee = await givenUserInstance(userRepository, {
        username: 'white',
      });

      const friend = await givenFriendInstance(friendRepository, {
        requestorId: user.id,
        requesteeId: requestee.id,
        status: FriendStatusType.APPROVED,
      });

      await client
        .del(`/user/friends/${friend.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(204);
      await expect(friendRepository.findById(friend.id)).to.be.rejectedWith(
        EntityNotFoundError,
      );
    });

    it('returns 401 when deleting friend as not login user', async () => {
      const requestor = await givenUserInstance(userRepository, {
        username: 'gold',
      });

      const requestee = await givenUserInstance(userRepository, {
        username: 'red',
      });

      const friend = await givenFriendInstance(friendRepository, {
        requestorId: requestor.id,
        requesteeId: requestee.id,
        status: FriendStatusType.APPROVED,
      });

      await client
        .del(`/user/friends/${friend.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(401);
    });

    it('returns 404 when deleting a friend that does not exist', async () => {
      await client
        .del(`/user/friends/99999`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  context('when dealing with multiple persisted friends', () => {
    it('finds all blocked friends', async () => {
      const requestee = await givenUserInstance(userRepository, {
        username: 'roger',
      });
      const blockedFriends = await givenFriendInstance(friendRepository, {
        requesteeId: requestee.id,
        requestorId: user.id,
        status: FriendStatusType.BLOCKED,
      });
      const response = await client
        .get(
          `/user/friends?status=${FriendStatusType.BLOCKED}&userId=${user.id}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      expect(response.body.data).to.containDeep(toJSON([blockedFriends]));
    });
  });

  it('includes requestee and requestor in query result', async () => {
    const requestee = await givenUserInstance(userRepository, {
      name: 'muchtar',
    });
    const friend = await givenFriendInstance(friendRepository, {
      requesteeId: requestee.id,
      requestorId: user.id,
      status: FriendStatusType.APPROVED,
    });
    const filter =
      'filter=' +
      JSON.stringify({
        include: ['requestor', 'requestee'],
      }) +
      `&status=${FriendStatusType.APPROVED}&userId=${user.id}`;

    const response = await client
      .get('/user/friends')
      .set('Authorization', `Bearer ${token}`)
      .query(filter);

    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0]).to.deepEqual({
      ...toJSON(friend),
      requestee: toJSON(requestee),
      requestor: toJSON(user),
    });
  });

  it('creates notification when sending a pending friend request', async () => {
    const otherUser = await givenUserInstance(userRepository, {
      username: 'irman',
    });

    const friend = givenFriend({
      requestorId: user.id.toString(),
      requesteeId: otherUser.id.toString(),
    });

    await client
      .post('/user/friends')
      .set('Authorization', `Bearer ${token}`)
      .send(friend)
      .expect(200);

    setTimeout(async () => {
      const notifications = await notificationRepository.find({
        where: {
          from: friend.requestorId,
          to: friend.requesteeId,
          referenceId: friend.requestorId,
        },
      });

      delete notifications[0].id;
      delete notifications[0].createdAt;
      delete notifications[0].updatedAt;

      expect({
        type: NotificationType.FRIEND_REQUEST,
        from: friend.requestorId,
        read: false,
        to: friend.requesteeId,
        referenceId: friend.requestorId,
        additionalReferenceId: [],
        message: 'sent you a friend request',
      }).to.containDeep(toJSON(notifications[0]));
    }, 10000);
  });

  it('creates notification when approving a pending friend request', async () => {
    const requestor = await givenUserInstance(userRepository, {
      username: 'husni',
    });

    const friend = await givenFriendInstance(friendRepository, {
      requestorId: requestor.id,
      requesteeId: user.id,
    });

    const updatedFriend = givenFriend({
      status: FriendStatusType.APPROVED,
    });

    await client
      .patch(`/user/friends/${friend.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(updatedFriend)
      .expect(204);

    setTimeout(async () => {
      const notifications = await notificationRepository.find({
        where: {
          from: user.id.toString(),
          to: requestor.id.toString(),
          referenceId: friend.requesteeId.toString(),
        },
      });

      delete notifications[0].id;
      delete notifications[0].createdAt;
      delete notifications[0].updatedAt;

      expect({
        type: NotificationType.FRIEND_ACCEPT,
        from: friend.requesteeId,
        read: false,
        to: friend.requestorId,
        referenceId: friend.requesteeId,
        additionalReferenceId: [],
        message: 'accept your friend request',
      }).to.containEql(toJSON(notifications[0]));
    }, 10000);
  });
});

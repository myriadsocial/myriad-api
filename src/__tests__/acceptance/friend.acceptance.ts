import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {FriendStatusType, NotificationType, WalletType} from '../../enums';
import {Credential, Friend, User} from '../../models';
import {
  ActivityLogRepository,
  FriendRepository,
  NotificationRepository,
  UserRepository,
} from '../../repositories';
import {
  deleteAllRepository,
  givenActivityLogRepository,
  givenAddress,
  givenFriend,
  givenFriendInstance,
  givenFriendRepository,
  givenMultipleFriendInstances,
  givenNotificationRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';
import {u8aToHex, numberToHex} from '@polkadot/util';
import {KeyringPair} from '@polkadot/keyring/types';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('FriendApplication', function () {
  this.timeout(20000);

  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let friendRepository: FriendRepository;
  let userRepository: UserRepository;
  let notificationRepository: NotificationRepository;
  let activityLogRepository: ActivityLogRepository;
  let nonce: number;
  let user: User;
  let address: KeyringPair;

  before(async () => {
    ({app, client} = await setupApplication(true));
  });

  after(() => app.stop());

  before(async () => {
    friendRepository = await givenFriendRepository(app);
    userRepository = await givenUserRepository(app);
    notificationRepository = await givenNotificationRepository(app);
    activityLogRepository = await givenActivityLogRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    address = givenAddress();
  });

  beforeEach(async () => {
    await friendRepository.deleteAll();
    await activityLogRepository.deleteAll();
  });

  after(async () => {
    await deleteAllRepository(app);
  });

  it('gets user nonce', async () => {
    const response = await client.get(`/users/${user.id}/nonce`).expect(200);

    nonce = response.body.nonce;
  });

  it('user login successfully', async () => {
    const credential: Credential = new Credential({
      nonce: nonce,
      publicAddress: user.id,
      signature: u8aToHex(address.sign(numberToHex(nonce))),
      walletType: WalletType.POLKADOT,
    });

    const res = await client.post('/login').send(credential).expect(200);
    token = res.body.accessToken;
  });

  it('creates a pending friend request', async function () {
    const requestee = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61861',
    });

    const friend = givenFriend({
      requesteeId: requestee.id,
      requestorId: user.id,
    });

    const response = await client
      .post('/friends')
      .set('Authorization', `Bearer ${token}`)
      .send(friend)
      .expect(200);
    expect(response.body).to.containDeep(friend);
    const result = await friendRepository.findById(response.body.id);
    expect(result).to.containDeep(friend);
  });

  it('returns 401 when creates a pending request not as login user', async () => {
    const friend = givenFriend({
      requestorId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61860',
      requesteeId: user.id,
    });

    await client
      .post('/friends')
      .set('Authorization', `Bearer ${token}`)
      .send(friend)
      .expect(401);
  });

  it('returns 422 when creates a pending friend request with no requesteeId/no requestorId', async () => {
    const friendWithNoRequesteeId = givenFriend({
      requestorId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61860',
    });

    await client
      .post('/friends')
      .set('Authorization', `Bearer ${token}`)
      .send(friendWithNoRequesteeId)
      .expect(422);

    const friendWithNoRequestorId = givenFriend({
      requesteeId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61861',
    });

    await client
      .post('/friends')
      .set('Authorization', `Bearer ${token}`)
      .send(friendWithNoRequestorId)
      .expect(422);
  });

  it('rejects requests to create a pending friend request with requesteeId/requestorId length less/more than 66', async () => {
    const friendWithRequestorAndRequesteeLengthLessThan66: Partial<Friend> =
      givenFriend({
        requesteeId:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
        requestorId:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6185',
      });

    await client
      .post('/friends')
      .set('Authorization', `Bearer ${token}`)
      .send(friendWithRequestorAndRequesteeLengthLessThan66)
      .expect(422);

    const friendWithRequestorAndRequesteeLengthMoreThan66: Partial<Friend> =
      givenFriend({
        requesteeId:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618612',
        requestorId:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618532',
      });

    await client
      .post('/friends')
      .set('Authorization', `Bearer ${token}`)
      .send(friendWithRequestorAndRequesteeLengthMoreThan66)
      .expect(422);
  });

  it('rejects requests to create a pending friend request with requesteeId equal requestorId', async () => {
    const friend: Partial<Friend> = givenFriend({
      requesteeId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
      requestorId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
    });

    await client
      .post('/friends')
      .set('Authorization', `Bearer ${token}`)
      .send(friend)
      .expect(422);
  });

  it('rejects requests to create a double pending friend request', async () => {
    const friend = givenFriend({
      requesteeId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6185',
      requestorId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
    });
    await givenFriendInstance(friendRepository, {
      requesteeId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
      requestorId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6185',
    });

    await client
      .post('/friends')
      .set('Authorization', `Bearer ${token}`)
      .send(friend)
      .expect(422);
  });

  it('rejects requests to create a pending friend request when already friend', async () => {
    const friend = givenFriend({
      requesteeId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6185',
      requestorId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
    });
    await givenFriendInstance(friendRepository, {
      status: FriendStatusType.APPROVED,
      requesteeId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
      requestorId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6185',
    });

    await client
      .post('/friends')
      .set('Authorization', `Bearer ${token}`)
      .send(friend)
      .expect(422);
  });

  it('rejects requests to create a pending friend request when requesteeId and requestorId not in hex', async () => {
    const friend = givenFriend({
      requesteeId:
        '0006cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6185',
      requestorId:
        '0006cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
    });

    await client
      .post('/friends')
      .set('Authorization', `Bearer ${token}`)
      .send(friend)
      .expect(422);
  });

  it('rejects requests to create a pending friend request more than 20', async () => {
    const multiplePendingRequest = [];

    for (let i = 11; i < 31; i++) {
      const requesteeId =
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee60' + i;
      const requestorId =
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61' + i;

      multiplePendingRequest.push(
        givenFriendInstance(friendRepository, {
          requesteeId,
          requestorId,
        }),
      );
    }

    await Promise.all(multiplePendingRequest);

    const friend = givenFriend({
      requesteeId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6185',
      requestorId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
    });

    await client
      .post('/friends')
      .set('Authorization', `Bearer ${token}`)
      .send(friend)
      .expect(422);
  });

  context('when dealing with a single persisted friend', () => {
    let persistedFriend: Friend;

    beforeEach(async () => {
      persistedFriend = await givenFriendInstance(friendRepository, {
        requesteeId:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
        requestorId:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6185',
      });
    });

    it('gets a friends by ID', async () => {
      const result = await client
        .get(`/friends/${persistedFriend.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      const expected = toJSON(persistedFriend);

      expect(result.body).to.deepEqual(expected);
    });

    it('returns 404 when getting a friend that does not exist', () => {
      return client
        .get('/friends/99999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('updates the friend by ID ', async () => {
      const requestor = await givenUserInstance(userRepository, {
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6112',
      });

      const friend = await givenFriendInstance(friendRepository, {
        requestorId: requestor.id,
        requesteeId: user.id,
      });

      const updatedFriend = givenFriend({
        status: FriendStatusType.APPROVED,
      });

      await client
        .patch(`/friends/${friend.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedFriend)
        .expect(204);

      const result = await friendRepository.findById(friend.id);
      expect(result).to.containEql(updatedFriend);
    });

    it('returns 401 when updating the friend by ID as not login user', async () => {
      const requestor = await givenUserInstance(userRepository, {
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5kbf48b915e8449ee6112',
      });
      const requestee = await givenUserInstance(userRepository, {
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449e2v112',
      });

      const friend = await givenFriendInstance(friendRepository, {
        requestorId: requestor.id,
        requesteeId: requestee.id,
      });

      const updatedFriend = givenFriend({
        status: FriendStatusType.APPROVED,
      });

      await client
        .patch(`/friends/${friend.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedFriend)
        .expect(401);
    });

    it('returns 404 when updating a friend that does not exist', () => {
      return client
        .patch('/friends/99999')
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
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d33a5fef48b915e8449ee6112',
      });

      const friend = await givenFriendInstance(friendRepository, {
        requestorId: user.id,
        requesteeId: requestee.id,
        status: FriendStatusType.APPROVED,
      });

      await client
        .del(`/friends/${friend.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(204);
      await expect(friendRepository.findById(friend.id)).to.be.rejectedWith(
        EntityNotFoundError,
      );
    });

    it('returns 401 when deleting friend as not login user', async () => {
      const requestor = await givenUserInstance(userRepository, {
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a2m1d33a5fef48b915e8449ee6112',
      });

      const requestee = await givenUserInstance(userRepository, {
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a2m1d33a5fef48b915e8449ee6118',
      });

      const friend = await givenFriendInstance(friendRepository, {
        requestorId: requestor.id,
        requesteeId: requestee.id,
        status: FriendStatusType.APPROVED,
      });

      await client
        .del(`/friends/${friend.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(401);
    });

    it('returns 404 when deleting a friend that does not exist', async () => {
      await client
        .del(`/friends/99999`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  context('when dealing with multiple persisted friends', () => {
    let persistedFriends: Friend[];

    beforeEach(async () => {
      persistedFriends = await givenMultipleFriendInstances(friendRepository);
    });

    it('finds all friends', async () => {
      const response = await client
        .get('/friends')
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      expect(response.body.data).to.containDeep(toJSON(persistedFriends));
    });

    it('finds all blocked friends', async () => {
      const requestee = await givenUserInstance(userRepository, {
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48w115e8449ee61859',
      });
      const requestor = await givenUserInstance(userRepository, {
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fli48b915e8449ee61859',
      });
      const blockedFriends = await givenFriendInstance(friendRepository, {
        requesteeId: requestee.id,
        requestorId: requestor.id,
        status: FriendStatusType.BLOCKED,
      });
      const response = await client
        .get('/friends?filter[where][status]=blocked')
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      expect(response.body.data).to.containDeep(toJSON([blockedFriends]));
    });

    it('queries friends with a filter', async () => {
      const friendInProgress = await givenFriendInstance(friendRepository, {
        status: FriendStatusType.APPROVED,
        requesteeId:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61864',
        requestorId:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61865',
      });

      await client
        .get('/friends')
        .set('Authorization', `Bearer ${token}`)
        .query(
          'filter=' +
            JSON.stringify({where: {status: FriendStatusType.APPROVED}}),
        )
        .expect(200, {
          data: [toJSON(friendInProgress)],
          meta: {
            currentPage: 1,
            itemsPerPage: 1,
            totalItemCount: 1,
            totalPageCount: 1,
          },
        });
    });

    it('exploded filter conditions work', async () => {
      await givenFriendInstance(friendRepository, {
        requesteeId:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61866',
        requestorId:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61867',
      });

      const response = await client
        .get('/friends')
        .set('Authorization', `Bearer ${token}`)
        .query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });

  it('includes requestee and requestor in query result', async () => {
    const requestor = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61868',
      name: 'imam',
    });
    const requestee = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61869',
      name: 'muchtar',
    });
    const friend = await givenFriendInstance(friendRepository, {
      requesteeId: requestee.id,
      requestorId: requestor.id,
    });
    const filter =
      'filter=' + JSON.stringify({include: ['requestor', 'requestee']});

    const response = await client
      .get('/friends')
      .set('Authorization', `Bearer ${token}`)
      .query(filter);

    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0]).to.deepEqual({
      ...toJSON(friend),
      requestee: toJSON(requestee),
      requestor: toJSON(requestor),
    });
  });

  it('creates notification when sending a pending friend request', async () => {
    const otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });

    const friend = givenFriend({
      requestorId: user.id,
      requesteeId: otherUser.id,
    });

    await client
      .post('/friends')
      .set('Authorization', `Bearer ${token}`)
      .send(friend)
      .expect(200);

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
      message: 'sent you friend request',
    }).to.containDeep(toJSON(notifications[0]));
  });

  it('creates notification when approving a pending friend request', async () => {
    const requestor = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915hh449ee6181c',
    });

    const friend = await givenFriendInstance(friendRepository, {
      requestorId: requestor.id,
      requesteeId: user.id,
    });

    const updatedFriend = givenFriend({
      status: FriendStatusType.APPROVED,
    });

    await client
      .patch(`/friends/${friend.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(updatedFriend)
      .expect(204);

    const notifications = await notificationRepository.find({
      where: {
        from: user.id,
        to: requestor.id,
        referenceId: friend.requesteeId,
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
  });
});

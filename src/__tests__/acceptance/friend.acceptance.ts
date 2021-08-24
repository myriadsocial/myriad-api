import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {FriendStatusType} from '../../enums';
import {Friend} from '../../models';
import {FriendRepository, UserRepository} from '../../repositories';
import {
  givenFriend,
  givenFriendInstance,
  givenFriendRepository,
  givenMultipleFriendInstances,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';

describe('FriendApplication', function () {
  let app: MyriadApiApplication;
  let client: Client;
  let friendRepository: FriendRepository;
  let userRepository: UserRepository;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    friendRepository = await givenFriendRepository(app);
    userRepository = await givenUserRepository(app);
  });

  beforeEach(async () => {
    await friendRepository.deleteAll();
    await userRepository.deleteAll();
  });

  it('creates a pending friend request', async function () {
    const friend = givenFriend({
      requesteeId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61860',
      requestorId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61861',
    });

    const response = await client.post('/friends').send(friend).expect(200);
    expect(response.body).to.containDeep(friend);
    const result = await friendRepository.findById(response.body.id);
    expect(result).to.containDeep(friend);
  });

  it('returns 422 when creates a pending friend request with no requesteeId/no requestorId', async () => {
    const friendWithNoRequesteeId = givenFriend({
      requestorId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61860',
    });

    await client.post('/friends').send(friendWithNoRequesteeId).expect(422);

    const friendWithNoRequestorId = givenFriend({
      requestorId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61861',
    });

    await client.post('/friends').send(friendWithNoRequestorId).expect(422);
  });

  it('rejects requests to create a pending friend request with requesteeId/requestorId length less/more than 66', async () => {
    const friendWithRequestorAndRequesteeLengthLessThan66: Partial<Friend> = givenFriend({
      requesteeId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
      requestorId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6185',
    });

    await client.post('/friends').send(friendWithRequestorAndRequesteeLengthLessThan66).expect(422);

    const friendWithRequestorAndRequesteeLengthMoreThan66: Partial<Friend> = givenFriend({
      requesteeId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618612',
      requestorId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618532',
    });

    await client.post('/friends').send(friendWithRequestorAndRequesteeLengthMoreThan66).expect(422);
  });

  it('rejects requests to create a pending friend request with requesteeId equal requestorId', async () => {
    const friend: Partial<Friend> = givenFriend({
      requesteeId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
      requestorId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
    });

    await client.post('/friends').send(friend).expect(422);
  });

  it('rejects requests to create a double pending friend request', async () => {
    const friend = givenFriend({
      requesteeId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6185',
      requestorId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
    });
    await givenFriendInstance(friendRepository, {
      requesteeId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
      requestorId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6185',
    });

    await client.post('/friends').send(friend).expect(422);
  });

  it('rejects requests to create a pending friend request when already friend', async () => {
    const friend = givenFriend({
      requesteeId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6185',
      requestorId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
    });
    await givenFriendInstance(friendRepository, {
      status: FriendStatusType.APPROVED,
      requesteeId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
      requestorId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6185',
    });

    await client.post('/friends').send(friend).expect(422);
  });

  it('rejects requests to create a pending friend request when requesteeId and requestorId not in hex', async () => {
    const friend = givenFriend({
      requesteeId: '0006cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6185',
      requestorId: '0006cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
    });

    await client.post('/friends').send(friend).expect(422);
  });

  it('rejects requests to create a pending friend request more than 20', async () => {
    const multiplePendingRequest = [];

    for (let i = 11; i < 31; i++) {
      const requesteeId = '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee60' + i;
      const requestorId = '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61' + i;

      multiplePendingRequest.push(
        givenFriendInstance(friendRepository, {
          requesteeId,
          requestorId,
        }),
      );
    }

    await Promise.all(multiplePendingRequest);

    const friend = givenFriend({
      requesteeId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6185',
      requestorId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
    });

    await client.post('/friends').send(friend).expect(422);
  });

  context('when dealing with a single persisted friend', () => {
    let persistedFriend: Friend;

    beforeEach(async () => {
      persistedFriend = await givenFriendInstance(friendRepository, {
        requesteeId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
        requestorId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6185',
      });
    });

    it('gets a friends by ID', async () => {
      const result = await client.get(`/friends/${persistedFriend.id}`).send().expect(200);
      const expected = toJSON(persistedFriend);

      expect(result.body).to.deepEqual(expected);
    });

    it('returns 404 when getting a friend that does not exist', () => {
      return client.get('/friends/99999').expect(404);
    });

    it('updates the friend by ID ', async () => {
      const updatedFriend = givenFriend({
        status: FriendStatusType.APPROVED,
      });

      await client.patch(`/friends/${persistedFriend.id}`).send(updatedFriend).expect(204);

      const result = await friendRepository.findById(persistedFriend.id);
      expect(result).to.containEql(updatedFriend);
    });

    it('returns 404 when updating a friend that does not exist', () => {
      return client.patch('/friends/99999').send(givenFriend()).expect(404);
    });

    it('deletes the friend', async () => {
      await client.del(`/friends/${persistedFriend.id}`).send().expect(204);
      await expect(friendRepository.findById(persistedFriend.id)).to.be.rejectedWith(
        EntityNotFoundError,
      );
    });

    it('returns 404 when deleting a friend that does not exist', async () => {
      await client.del(`/friends/99999`).expect(404);
    });
  });

  context('when dealing with multiple persisted friends', () => {
    let persistedFriends: Friend[];

    beforeEach(async () => {
      persistedFriends = await givenMultipleFriendInstances(friendRepository);
    });

    it('finds all friends', async () => {
      const response = await client.get('/friends').send().expect(200);
      expect(response.body.data).to.containDeep(toJSON(persistedFriends));
    });

    it('queries friends with a filter', async () => {
      const friendInProgress = await givenFriendInstance(friendRepository, {
        status: FriendStatusType.APPROVED,
        requesteeId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61864',
        requestorId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61865',
      });

      await client
        .get('/friends')
        .query('filter=' + JSON.stringify({where: {status: FriendStatusType.APPROVED}}))
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
        requesteeId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61866',
        requestorId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61867',
      });

      const response = await client.get('/friends').query('pageLimit=2');
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
    const filter = 'filter=' + JSON.stringify({include: ['requestor', 'requestee']});

    const response = await client.get('/friends').query(filter);

    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0]).to.deepEqual({
      ...toJSON(friend),
      requestee: toJSON(requestee),
      requestor: toJSON(requestor),
    });
  });
});

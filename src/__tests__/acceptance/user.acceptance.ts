import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {Credential, User} from '../../models';
import {
  ActivityLogRepository,
  CurrencyRepository,
  FriendRepository,
  UserCurrencyRepository,
  UserRepository,
  AccountSettingRepository,
  NotificationSettingRepository,
} from '../../repositories';
import {
  deleteAllRepository,
  givenAccesToken,
  givenAccountSettingRepository,
  givenActivityLogInstance,
  givenActivityLogRepository,
  givenAddress,
  givenCurrencyInstance,
  givenCurrencyRepository,
  givenFriendInstance,
  givenFriendRepository,
  givenNotificationSettingRepository,
  givenOtherUser,
  givenUser,
  givenUserCurrencyInstance,
  givenUserCurrencyRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';
import {u8aToHex, numberToHex} from '@polkadot/util';
import {KeyringPair} from '@polkadot/keyring/types';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('UserApplication', function () {
  this.timeout(20000);

  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let userRepository: UserRepository;
  let userCurrencyRepository: UserCurrencyRepository;
  let currencyRepository: CurrencyRepository;
  let friendRepository: FriendRepository;
  let activityLogRepository: ActivityLogRepository;
  let notificationSettingRepository: NotificationSettingRepository;
  let accountSettingRepository: AccountSettingRepository;
  let nonce: number;
  let user: User;
  let otherUser: User;
  let address: KeyringPair;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    userRepository = await givenUserRepository(app);
    userCurrencyRepository = await givenUserCurrencyRepository(app);
    currencyRepository = await givenCurrencyRepository(app);
    friendRepository = await givenFriendRepository(app);
    activityLogRepository = await givenActivityLogRepository(app);
    notificationSettingRepository = await givenNotificationSettingRepository(
      app,
    );
    accountSettingRepository = await givenAccountSettingRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    address = givenAddress();
    otherUser = await givenUserInstance(userRepository, givenOtherUser());
  });

  beforeEach(async () => {
    await currencyRepository.deleteAll();
    await userCurrencyRepository.deleteAll();
    await friendRepository.deleteAll();
    await activityLogRepository.deleteAll();
    await notificationSettingRepository.deleteAll();
    await accountSettingRepository.deleteAll();
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
    });

    const res = await client.post('/login').send(credential).expect(200);
    token = res.body.accessToken;
  });

  context('when dealing with a single persisted user', () => {
    it('gets a user by ID', async () => {
      const result = await client
        .get(`/users/${user.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      const expected = toJSON(user);

      expect(result.body).to.deepEqual(expected);
    });

    it('returns 404 when getting a user that does not exist', () => {
      return client
        .get('/users/99999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('return 401 when updating the user by ID not as login user', async () => {
      const accesToken = await givenAccesToken(otherUser);
      const updatedUser: Partial<User> = givenUser({
        name: 'Abdul Hakim',
        bio: 'Hello, my name is Abdul Hakim',
      });

      delete updatedUser.id;
      delete updatedUser.username;
      delete updatedUser.nonce;

      user.bio = updatedUser.bio;

      await client
        .patch(`/users/${user.id}`)
        .set('Authorization', `Bearer ${accesToken}`)
        .send(updatedUser)
        .expect(401);
    });

    it('updates the user by ID ', async () => {
      const updatedUser: Partial<User> = givenUser({
        name: 'Abdul Hakim',
        bio: 'Hello, my name is Abdul Hakim',
      });

      delete updatedUser.id;
      delete updatedUser.username;
      delete updatedUser.nonce;

      user.bio = updatedUser.bio;

      await client
        .patch(`/users/${user.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedUser)
        .expect(204);

      const result = await userRepository.findById(user.id);
      expect(result).to.containEql(updatedUser);
    });

    it('returns 422 when updating a username', async () => {
      const updatedUser: Partial<User> = givenUser({
        username: 'abdulhakim',
      });

      delete updatedUser.id;
      delete updatedUser.nonce;

      await client
        .patch(`/users/${user.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedUser)
        .expect(422);
    });

    it('returns 401 when updating a user that does not belong to user', async () => {
      const updatedUser: Partial<User> = givenUser();

      delete updatedUser.id;
      delete updatedUser.username;
      delete updatedUser.nonce;

      await client
        .patch(`/users/999999`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedUser)
        .expect(401);
    });
  });

  context('when dealing with multiple persisted users', () => {
    let persistedUsers: User[];

    before(async () => {
      const otherUserr = await givenUserInstance(userRepository, {
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61861',
        name: 'imam',
      });

      persistedUsers = [user, otherUserr];
    });

    it('finds all users', async () => {
      const response = await client
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);

      const expectedUser = response.body.data.map((e: Partial<User>) => {
        delete e.updatedAt;

        return e;
      });
      const responseUser = persistedUsers.map((e: Partial<User>) => {
        delete e.updatedAt;

        return e;
      });

      expect(toJSON(expectedUser)).to.containDeep(toJSON(responseUser));
    });

    it('queries users with a filter', async () => {
      const userInProgress = await givenUserInstance(userRepository, {
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61868',
        name: 'husni',
        bannerImageUrl: '',
        fcmTokens: [],
      });

      await client
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .query('filter=' + JSON.stringify({where: {name: 'husni'}}))
        .expect(200, {
          data: [toJSON(userInProgress)],
          meta: {
            currentPage: 1,
            itemsPerPage: 1,
            totalItemCount: 1,
            totalPageCount: 1,
          },
        });
    });

    it('exploded filter conditions work', async () => {
      await givenUserInstance(userRepository, {
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8452ee61861',
        name: 'imam',
      });

      const response = await client
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });

  it('includes friends, activityLogs, and currencies in query result', async () => {
    await userRepository.deleteById(otherUser.id);
    const currency = await givenCurrencyInstance(currencyRepository);
    const activityLog = await givenActivityLogInstance(activityLogRepository, {
      userId: user.id,
    });
    const friend = await givenFriendInstance(friendRepository, {
      requestorId: user.id,
      requesteeId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61860',
    });
    await givenUserCurrencyInstance(userCurrencyRepository, {
      userId: user.id,
      currencyId: currency.id,
    });

    const filter =
      'filter=' +
      JSON.stringify({
        include: ['friends', 'currencies', 'activityLogs'],
      });

    const response = await client
      .get('/users')
      .set('Authorization', `Bearer ${token}`)
      .query(filter);

    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0]).to.deepEqual({
      ...toJSON(user),
      friends: [toJSON(friend)],
      currencies: [toJSON(currency)],
      activityLogs: [toJSON(activityLog)],
    });
  });
});

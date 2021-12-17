import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {User} from '../../models';
import {
  ActivityLogRepository,
  CurrencyRepository,
  FriendRepository,
  UserCurrencyRepository,
  UserRepository,
  AccountSettingRepository,
  NotificationSettingRepository,
  AuthenticationRepository,
} from '../../repositories';
import {
  givenAccountSettingRepository,
  givenActivityLogInstance,
  givenActivityLogRepository,
  givenAuthenticationRepository,
  givenCurrencyInstance,
  givenCurrencyRepository,
  givenFriendInstance,
  givenFriendRepository,
  givenMultipleUserInstances,
  givenNotificationSettingRepository,
  givenUser,
  givenUserCurrencyInstance,
  givenUserCurrencyRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';

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
  let authenticationRepository: AuthenticationRepository;

  const userCredential = {
    email: 'admin@mail.com',
    password: '123456',
  };

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
    authenticationRepository = await givenAuthenticationRepository(app);
  });

  after(async () => {
    await authenticationRepository.deleteAll();
  });

  beforeEach(async () => {
    await userRepository.deleteAll();
    await currencyRepository.deleteAll();
    await userCurrencyRepository.deleteAll();
    await friendRepository.deleteAll();
    await activityLogRepository.deleteAll();
    await notificationSettingRepository.deleteAll();
    await accountSettingRepository.deleteAll();
  });

  it('sign up successfully', async () => {
    await client.post('/signup').send(userCredential).expect(200);
  });

  it('user login successfully', async () => {
    const res = await client.post('/login').send(userCredential).expect(200);
    token = res.body.accessToken;
  });

  it('creates a user', async () => {
    const user = givenUser();
    const response = await client
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send(user);

    expect(response.body).to.containDeep(user);
    const result = await userRepository.findById(response.body.id);
    expect(result).to.containDeep(user);
  });

  it('creates a user with default settings', async () => {
    const user = givenUser();
    const response = await client
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send(user);
    const createdUser = await userRepository.findById(response.body.id, {
      include: ['notificationSetting', 'accountSetting'],
    });
    const notificationSetting = await userRepository
      .notificationSetting(response.body.id)
      .get();
    const accountSetting = await userRepository
      .accountSetting(response.body.id)
      .get();
    expect(createdUser.accountSetting).to.containDeep(accountSetting);
    expect(createdUser.notificationSetting).to.containDeep(notificationSetting);
  });

  it('returns 422 when creates a user with same id', async () => {
    await givenUserInstance(userRepository);
    const user = givenUser();

    await client
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send(user)
      .expect(422);
  });

  it('rejects requests to create a user with no id', async () => {
    const user: Partial<User> = givenUser();
    delete user.id;
    await client
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send(user)
      .expect(422);
  });

  it('rejects requests to create a user with id type is not a hex', async () => {
    const user: Partial<User> = givenUser({
      id: '0006cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61860',
      name: 'Hakim',
    });
    await client
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send(user)
      .expect(422);
  });

  it('rejects requests to create a user with id length less than 66', async () => {
    const user: Partial<User> = givenUser({
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
      name: 'Hakim',
    });

    await client
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send(user)
      .expect(422);
  });

  it('rejects requests to create a user with id length more than 66', async () => {
    const user: Partial<User> = givenUser({
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618601',
      name: 'Hakim',
    });
    await client
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send(user)
      .expect(422);
  });

  it('rejects requests to create a user with name length less than 2', async () => {
    const user: Partial<User> = givenUser({
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61860',
      name: 'H',
    });
    await client
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send(user)
      .expect(422);
  });

  context('when dealing with a single persisted user', () => {
    let persistedUser: User;

    beforeEach(async () => {
      persistedUser = await givenUserInstance(userRepository, {
        username: 'qwerty123',
      });
    });

    it('gets a user by ID', async () => {
      const result = await client
        .get(`/users/${persistedUser.id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      const expected = toJSON(persistedUser);

      expect(result.body).to.deepEqual(expected);
    });

    it('returns 404 when getting a user that does not exist', () => {
      return client
        .get('/users/99999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('updates the user by ID ', async () => {
      const updatedUser: Partial<User> = givenUser({
        name: 'Abdul Hakim',
        bio: 'Hello, my name is Abdul Hakim',
      });

      delete updatedUser.id;
      delete updatedUser.username;

      await client
        .patch(`/users/${persistedUser.id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedUser)
        .expect(204);
      const result = await userRepository.findById(persistedUser.id);
      expect(result).to.containEql(updatedUser);
    });

    it('returns 422 when updating a username', async () => {
      const updatedUser: Partial<User> = givenUser({
        username: 'abdulhakim',
      });

      delete updatedUser.id;

      await client
        .patch(`/users/${persistedUser.id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedUser)
        .expect(422);
    });

    it('returns 404 when updating a user that does not exist', () => {
      const updatedUser: Partial<User> = givenUser();

      delete updatedUser.id;
      delete updatedUser.username;

      return client
        .patch('/users/99999')
        .set('Authorization', `Bearer ${token}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedUser)
        .expect(404);
    });
  });

  context('when dealing with multiple persisted users', () => {
    let persistedUsers: User[];

    beforeEach(async () => {
      persistedUsers = await givenMultipleUserInstances(userRepository);
    });

    it('finds all users', async () => {
      const response = await client
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      expect(toJSON(response.body.data)).to.containDeep(toJSON(persistedUsers));
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
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61861',
        name: 'imam',
      });

      const response = await client
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .set('Authorization', `Bearer ${token}`)
        .query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });

  it('includes friends, activityLogs, and currencies in query result', async () => {
    const user = await givenUserInstance(userRepository);
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

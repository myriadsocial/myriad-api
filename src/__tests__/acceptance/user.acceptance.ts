import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {DefaultCurrencyType} from '../../enums';
import {User} from '../../models';
import {
  CurrencyRepository,
  FriendRepository,
  UserCurrencyRepository,
  UserRepository,
} from '../../repositories';
import {
  givenCurrencyInstance,
  givenCurrencyRepository,
  givenFriendInstance,
  givenFriendRepository,
  givenMultipleUserInstances,
  givenUser,
  givenUserCurrencyInstance,
  givenUserCurrencyRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('UserApplication', function () {
  let app: MyriadApiApplication;
  let client: Client;
  let userRepository: UserRepository;
  let userCurrencyRepository: UserCurrencyRepository;
  let currencyRepository: CurrencyRepository;
  let friendRepository: FriendRepository;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    userRepository = await givenUserRepository(app);
    userCurrencyRepository = await givenUserCurrencyRepository(app);
    currencyRepository = await givenCurrencyRepository(app);
    friendRepository = await givenFriendRepository(app);
  });

  beforeEach(async () => {
    await userRepository.deleteAll();
    await currencyRepository.deleteAll();
    await userCurrencyRepository.deleteAll();
    await friendRepository.deleteAll();
  });

  it('creates a user with a default currency MYRIA and AUSD', async function () {
    this.timeout(10000);
    const user = givenUser();
    const response = await client.post('/users').send(user);
    expect(response.body).to.containDeep(user);
    const result = await userRepository.findById(response.body.id);
    expect(result).to.containDeep(user);

    const filter = JSON.stringify({include: ['currencies']});
    const usersIncludeCurrencies = await client.get('/users').query('filter=' + filter);
    const currencies = await currencyRepository.find({
      where: {
        or: [{id: DefaultCurrencyType.MYRIA}, {id: DefaultCurrencyType.AUSD}],
      },
    });

    expect(usersIncludeCurrencies.body.data).to.have.length(1);
    expect(usersIncludeCurrencies.body.data[0]).to.deepEqual({
      ...toJSON(result),
      currencies: [...toJSON(currencies)],
    });
  });

  it('returns 422 when creates a user with same id', async () => {
    await givenUserInstance(userRepository);
    const user = givenUser();

    await client.post('/users').send(user).expect(422);
  });

  it('rejects requests to create a user with no id', async () => {
    const user: Partial<User> = givenUser();
    delete user.id;
    await client.post('/users').send(user).expect(422);
  });

  it('rejects requests to create a user with id type is not a hex', async () => {
    const user: Partial<User> = givenUser({
      id: '0006cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61860',
      name: 'Hakim',
    });
    await client.post('/users').send(user).expect(422);
  });

  it('rejects requests to create a user with id length less than 66', async () => {
    const user: Partial<User> = givenUser({
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
      name: 'Hakim',
    });

    await client.post('/users').send(user).expect(422);
  });

  it('rejects requests to create a user with id length more than 66', async () => {
    const user: Partial<User> = givenUser({
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618601',
      name: 'Hakim',
    });
    await client.post('/users').send(user).expect(422);
  });

  it('rejects requests to create a user with name length less than 3', async () => {
    const user: Partial<User> = givenUser({
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61860',
      name: 'Hi',
    });
    await client.post('/users').send(user).expect(422);
  });

  context('when dealing with a single persisted user', () => {
    let persistedUser: User;

    beforeEach(async () => {
      persistedUser = await givenUserInstance(userRepository);
    });

    it('gets a user by ID', async () => {
      const result = await client.get(`/users/${persistedUser.id}`).send().expect(200);
      const expected = toJSON(persistedUser);

      expect(result.body).to.deepEqual(expected);
    });

    it('returns 404 when getting a user that does not exist', () => {
      return client.get('/users/99999').expect(404);
    });

    it('updates the user by ID ', async () => {
      const updatedUser = givenUser({
        name: 'Abdul Hakim',
        bio: 'Hello, my name is Abdul Hakim',
      });
      await client.patch(`/users/${updatedUser.id}`).send(updatedUser).expect(204);
      const result = await userRepository.findById(updatedUser.id);
      expect(result).to.containEql(updatedUser);
    });

    it('returns 404 when updating a user that does not exist', () => {
      return client.patch('/users/99999').send(givenUser()).expect(404);
    });

    it('deletes the user', async () => {
      await client.del(`/users/${persistedUser.id}`).send().expect(204);
      await expect(userRepository.findById(persistedUser.id)).to.be.rejectedWith(
        EntityNotFoundError,
      );
    });

    it('returns 404 when deleting a user that does not exist', async () => {
      await client.del(`/users/99999`).expect(404);
    });
  });

  context('when dealing with multiple persisted users', () => {
    let persistedUsers: User[];

    beforeEach(async () => {
      persistedUsers = await givenMultipleUserInstances(userRepository);
    });

    it('finds all users', async () => {
      const response = await client.get('/users').send().expect(200);
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

      const response = await client.get('/users').query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });

  it('includes friends and currencies in query result', async () => {
    const user = await givenUserInstance(userRepository);
    const currency = await givenCurrencyInstance(currencyRepository);
    const friend = await givenFriendInstance(friendRepository, {
      requesteeId: user.id,
      requestorId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61860',
    });
    await givenUserCurrencyInstance(userCurrencyRepository, {
      userId: user.id,
      currencyId: currency.id,
    });

    const filter =
      'filter=' +
      JSON.stringify({
        include: ['friends', 'currencies'],
      });

    const response = await client.get('/users').query(filter);

    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0]).to.deepEqual({
      ...toJSON(user),
      friends: [toJSON(friend)],
      currencies: [toJSON(currency)],
    });
  });
});

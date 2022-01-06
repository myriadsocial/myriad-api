import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {User} from '../../models';
import {
  AccountSettingRepository,
  NotificationSettingRepository,
  UserRepository,
} from '../../repositories';
import {
  givenAccountSettingRepository,
  givenAddress,
  givenCredential,
  givenNotificationSettingRepository,
  givenUser,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';
import {u8aToHex, numberToHex} from '@polkadot/util';
import {KeyringPair} from '@polkadot/keyring/types';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('AuthenticationApplication', function () {
  this.timeout(10000);

  let app: MyriadApiApplication;
  let client: Client;
  let address: KeyringPair;
  let userRepository: UserRepository;
  let accountSettingRepository: AccountSettingRepository;
  let notificationSettingRepository: NotificationSettingRepository;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    userRepository = await givenUserRepository(app);
    accountSettingRepository = await givenAccountSettingRepository(app);
    notificationSettingRepository = await givenNotificationSettingRepository(
      app,
    );

    address = givenAddress();
  });

  beforeEach(async () => {
    await userRepository.deleteAll();
    await accountSettingRepository.deleteAll();
    await notificationSettingRepository.deleteAll();
  });

  it('successfully sign up a new user', async () => {
    const user: Partial<User> = givenUser();

    delete user.nonce;

    const response = await client.post('/signup').send(user);
    expect(response.body).to.containDeep(user);
    const result = await userRepository.findById(response.body.id);
    expect(result).to.containDeep(user);
  });

  it('creates a user with default settings', async () => {
    const user: Partial<User> = givenUser();

    delete user.nonce;

    const response = await client.post('/signup').send(user);
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

    const user: Partial<User> = givenUser();

    delete user.nonce;

    await client.post('/signup').send(user).expect(422);
  });

  it('rejects requests to create a user with no id', async () => {
    const user: Partial<User> = givenUser();

    delete user.id;
    delete user.nonce;

    await client.post('/signup').send(user).expect(422);
  });

  it('rejects requests to create a user with id type is not a hex', async () => {
    const user: Partial<User> = givenUser({
      id: '0006cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61860',
      name: 'Hakim',
    });

    delete user.nonce;

    await client.post('/signup').send(user).expect(422);
  });

  it('rejects requests to create a user with id length less than 66', async () => {
    const user: Partial<User> = givenUser({
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6186',
      name: 'Hakim',
    });

    delete user.nonce;

    await client.post('/signup').send(user).expect(422);
  });

  it('rejects requests to create a user with id length more than 66', async () => {
    const user: Partial<User> = givenUser({
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618601',
      name: 'Hakim',
    });

    delete user.nonce;

    await client.post('/signup').send(user).expect(422);
  });

  it('rejects requests to create a user with name length less than 2', async () => {
    const user: Partial<User> = givenUser({
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61860',
      name: 'H',
    });
    await client.post('/signup').send(user).expect(422);
  });

  it('successfully login', async () => {
    const user = await givenUserInstance(userRepository);
    const credential = givenCredential({
      nonce: user.nonce,
      signature: u8aToHex(address.sign(numberToHex(user.nonce))),
    });

    const response = await client.post('/login').send(credential).expect(200);

    expect(response.body).to.have.property('accessToken');
  });

  it('changes user nonce after login', async () => {
    const user = await givenUserInstance(userRepository);
    const credential = givenCredential({
      nonce: user.nonce,
      signature: u8aToHex(address.sign(numberToHex(user.nonce))),
    });

    await client.post('/login').send(credential).expect(200);

    const updatedUser = await userRepository.findById(user.id);

    expect(updatedUser.nonce).to.not.equal(user.nonce);
  });

  it('checks authentication flow', async () => {
    const user: Partial<User> = givenUser();

    delete user.nonce;

    const getNonce = await client.get(`/users/${user.id}/nonce`).expect(200);

    expect(getNonce.body).to.equal(null);

    const response = await client.post('/signup').send(user).expect(200);

    const createdUser = await userRepository.findById(response.body.id);
    const nonce = createdUser.nonce;
    const signature = u8aToHex(address.sign(numberToHex(nonce)));
    const credential = givenCredential({
      nonce: nonce,
      signature: signature,
      publicAddress: response.body.id,
    });

    await client.post('/login').send(credential).expect(200);
  });
});
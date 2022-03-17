import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {UserWallet} from '../../models';
import {
  AccountSettingRepository,
  NotificationSettingRepository,
  UserRepository,
  WalletRepository,
} from '../../repositories';
import {
  deleteAllRepository,
  givenAccountSettingRepository,
  givenAddress,
  givenCredential,
  givenNotificationSettingRepository,
  givenUserInstance,
  givenUserRepository,
  givenUserWallet,
  givenWalletInstance,
  givenWalletRepository,
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
  let walletRepository: WalletRepository;

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
    walletRepository = await givenWalletRepository(app);

    address = givenAddress();
  });

  beforeEach(async () => {
    await userRepository.deleteAll();
    await accountSettingRepository.deleteAll();
    await notificationSettingRepository.deleteAll();
    await walletRepository.deleteAll();
  });

  after(async () => {
    await deleteAllRepository(app);
  });

  it('successfully sign up a new user', async () => {
    const userWallet = givenUserWallet();

    const response = await client.post('/signup').send(userWallet);
    expect(response.body).to.have.property('nonce');
  });

  it('creates a user with default settings', async () => {
    const userWallet: UserWallet = givenUserWallet();

    await client.post('/signup').send(userWallet);
    const createdUser = await userRepository.findOne({
      where: {username: userWallet.username},
      include: ['notificationSetting', 'accountSetting'],
    });
    const notificationSetting = await userRepository
      .notificationSetting(createdUser ? createdUser.id : '')
      .get();
    const accountSetting = await userRepository
      .accountSetting(createdUser ? createdUser.id : '')
      .get();
    expect(createdUser?.accountSetting).to.containDeep(accountSetting);
    expect(createdUser?.notificationSetting).to.containDeep(
      notificationSetting,
    );
  });

  it('rejects login when wrong signature', async () => {
    const user = await givenUserInstance(userRepository);
    const credential = givenCredential({
      nonce: user.nonce + 1,
      signature: u8aToHex(address.sign(numberToHex(user.nonce))),
    });

    await client.post('/login').send(credential).expect(401);
  });

  it('changes user nonce after login', async () => {
    const user = await givenUserInstance(userRepository, {username: 'johndoe'});
    await givenWalletInstance(walletRepository, {userId: user.id});
    const credential = givenCredential({
      nonce: user.nonce,
      signature: u8aToHex(address.sign(numberToHex(user.nonce))),
    });

    await client.post('/login').send(credential).expect(200);

    const updatedUser = await userRepository.findById(user.id);

    expect(updatedUser.nonce).to.not.equal(user.nonce);
  });

  it('checks authentication flow', async () => {
    const userWallet = givenUserWallet();

    const getNonce = await client
      .get(`/wallets/${userWallet.address}/nonce`)
      .expect(200);

    expect(getNonce.body).to.containDeep({nonce: 0});

    await client.post('/signup').send(userWallet).expect(200);

    const createdUser = await userRepository.findOne({
      where: {username: userWallet.username},
    });
    const nonce = createdUser?.nonce;
    const signature = u8aToHex(address.sign(numberToHex(nonce)));
    const credential = givenCredential({
      nonce: nonce,
      signature: signature,
      publicAddress: userWallet.address,
    });

    await client.post('/login').send(credential).expect(200);
  });
});

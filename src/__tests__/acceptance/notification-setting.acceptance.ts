import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../..';
import {Credential, NotificationSetting, User} from '../../models';
import {
  NotificationSettingRepository,
  UserRepository,
} from '../../repositories';
import {
  givenAddress,
  givenNotificationSetting,
  givenNotificationSettingInstance,
  givenNotificationSettingRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';
import {u8aToHex, numberToHex} from '@polkadot/util';
import {KeyringPair} from '@polkadot/keyring/types';

describe('NotificationSettingApplication', () => {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let notificationSettingRepository: NotificationSettingRepository;
  let userRepository: UserRepository;
  let nonce: number;
  let user: User;
  let address: KeyringPair;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    userRepository = await givenUserRepository(app);
    notificationSettingRepository = await givenNotificationSettingRepository(
      app,
    );
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    address = givenAddress();
  });

  beforeEach(async () => {
    await notificationSettingRepository.deleteAll();
  });

  after(async () => {
    await userRepository.deleteAll();
  });

  it('gets user nonce', async () => {
    const response = await client.get(`/users/${user.id}/nonce`).expect(200);

    nonce = response.body;
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

  it('updates the notificationSetting by ID', async () => {
    const notificationSetting = await givenNotificationSettingInstance(
      notificationSettingRepository,
      {userId: user.id},
    );

    const updatedNotificationSetting: Partial<NotificationSetting> =
      givenNotificationSetting({
        comments: true,
      });

    await client
      .patch(`/users/${user.id}/notification-setting`)
      .set('Authorization', `Bearer ${token}`)
      .send(updatedNotificationSetting);

    const result = await notificationSettingRepository.findById(
      notificationSetting.id,
    );
    expect(result).to.containDeep(updatedNotificationSetting);
  });
});

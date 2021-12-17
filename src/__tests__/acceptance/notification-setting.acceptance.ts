import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../..';
import {NotificationSetting} from '../../models';
import {
  NotificationSettingRepository,
  UserRepository,
  AuthenticationRepository,
} from '../../repositories';
import {
  givenNotificationSetting,
  givenNotificationSettingInstance,
  givenNotificationSettingRepository,
  givenUserInstance,
  givenUserRepository,
  givenAuthenticationRepository,
  setupApplication,
} from '../helpers';

describe('NotificationSettingApplication', () => {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let notificationSettingRepository: NotificationSettingRepository;
  let authenticationRepository: AuthenticationRepository;
  let userRepository: UserRepository;

  const userCredential = {
    email: 'admin@mail.com',
    password: '123456',
  };

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    authenticationRepository = await givenAuthenticationRepository(app);
    userRepository = await givenUserRepository(app);
    notificationSettingRepository = await givenNotificationSettingRepository(
      app,
    );
  });

  after(async () => {
    await authenticationRepository.deleteAll();
  });

  beforeEach(async () => {
    await notificationSettingRepository.deleteAll();
    await userRepository.deleteAll();
  });

  it('sign up successfully', async () => {
    await client.post('/signup').send(userCredential).expect(200);
  });

  it('user login successfully', async () => {
    const res = await client.post('/login').send(userCredential).expect(200);
    token = res.body.accessToken;
  });

  it('updates the notificationSetting by ID', async () => {
    const user = await givenUserInstance(userRepository);
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

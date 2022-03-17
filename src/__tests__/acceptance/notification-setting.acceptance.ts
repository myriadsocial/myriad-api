import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../..';
import {NotificationSetting, User} from '../../models';
import {
  NotificationSettingRepository,
  UserRepository,
} from '../../repositories';
import {
  deleteAllRepository,
  givenAccesToken,
  givenNotificationSetting,
  givenNotificationSettingInstance,
  givenNotificationSettingRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';

describe('NotificationSettingApplication', () => {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let notificationSettingRepository: NotificationSettingRepository;
  let userRepository: UserRepository;
  let user: User;

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
    token = await givenAccesToken(user);
  });

  beforeEach(async () => {
    await notificationSettingRepository.deleteAll();
  });

  after(async () => {
    await deleteAllRepository(app);
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

import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../..';
import {NotificationSetting} from '../../models';
import {
  NotificationSettingRepository,
  UserRepository,
} from '../../repositories';
import {
  givenNotificationSetting,
  givenNotificationSettingInstance,
  givenNotificationSettingRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';

describe('NotificationSettingApplication', () => {
  let app: MyriadApiApplication;
  let client: Client;
  let notificationSettingRepository: NotificationSettingRepository;
  let userRepository: UserRepository;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    notificationSettingRepository = await givenNotificationSettingRepository(
      app,
    );
    userRepository = await givenUserRepository(app);
  });

  beforeEach(async () => {
    await notificationSettingRepository.deleteAll();
    await userRepository.deleteAll();
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
      .send(updatedNotificationSetting);

    const result = await notificationSettingRepository.findById(
      notificationSetting.id,
    );
    expect(result).to.containDeep(updatedNotificationSetting);
  });
});

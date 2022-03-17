import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../..';
import {AccountSettingType} from '../../enums';
import {AccountSetting, User} from '../../models';
import {AccountSettingRepository, UserRepository} from '../../repositories';
import {
  deleteAllRepository,
  givenAccesToken,
  givenAccountSetting,
  givenAccountSettingInstance,
  givenAccountSettingRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';

describe('AccountSettingApplication', () => {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let accountSettingRepository: AccountSettingRepository;
  let userRepository: UserRepository;
  let user: User;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    accountSettingRepository = await givenAccountSettingRepository(app);
    userRepository = await givenUserRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    token = await givenAccesToken(user);
  });

  beforeEach(async () => {
    await accountSettingRepository.deleteAll();
  });

  after(async () => {
    await deleteAllRepository(app);
  });

  it('updates the accountSetting by ID', async () => {
    const accountSetting = await givenAccountSettingInstance(
      accountSettingRepository,
      {
        userId: user.id,
      },
    );

    const updatedAccountSetting: Partial<AccountSetting> = givenAccountSetting({
      accountPrivacy: AccountSettingType.PRIVATE,
    });

    await client
      .patch(`/users/${user.id}/account-setting`)
      .set('Authorization', `Bearer ${token}`)
      .send(updatedAccountSetting);

    const result = await accountSettingRepository.findById(accountSetting.id);
    expect(result).to.containDeep(updatedAccountSetting);
  });
});

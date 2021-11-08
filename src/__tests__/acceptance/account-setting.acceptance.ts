import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../..';
import {AccountSettingType} from '../../enums';
import {AccountSetting} from '../../models';
import {AccountSettingRepository, UserRepository} from '../../repositories';
import {
  givenAccountSetting,
  givenAccountSettingInstance,
  givenAccountSettingRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';

describe('AccountSettingApplication', () => {
  let app: MyriadApiApplication;
  let client: Client;
  let accountSettingRepository: AccountSettingRepository;
  let userRepository: UserRepository;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    accountSettingRepository = await givenAccountSettingRepository(app);
    userRepository = await givenUserRepository(app);
  });

  beforeEach(async () => {
    await accountSettingRepository.deleteAll();
    await userRepository.deleteAll();
  });

  it('updates the accountSetting by ID', async () => {
    const user = await givenUserInstance(userRepository);
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
      .send(updatedAccountSetting);

    const result = await accountSettingRepository.findById(accountSetting.id);
    expect(result).to.containDeep(updatedAccountSetting);
  });
});

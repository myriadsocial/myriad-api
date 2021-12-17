import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../..';
import {AccountSettingType} from '../../enums';
import {AccountSetting} from '../../models';
import {
  AccountSettingRepository,
  AuthenticationRepository,
  UserRepository,
} from '../../repositories';
import {
  givenAccountSetting,
  givenAccountSettingInstance,
  givenAccountSettingRepository,
  givenAuthenticationRepository,
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
    accountSettingRepository = await givenAccountSettingRepository(app);
    userRepository = await givenUserRepository(app);
    authenticationRepository = await givenAuthenticationRepository(app);
  });

  after(async () => {
    await authenticationRepository.deleteAll();
  });

  beforeEach(async () => {
    await accountSettingRepository.deleteAll();
    await userRepository.deleteAll();
  });

  it('sign up successfully', async () => {
    await client.post('/signup').send(userCredential).expect(200);
  });

  it('user login successfully', async () => {
    const res = await client.post('/login').send(userCredential).expect(200);
    token = res.body.accessToken;
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
      .set('Authorization', `Bearer ${token}`)
      .send(updatedAccountSetting);

    const result = await accountSettingRepository.findById(accountSetting.id);
    expect(result).to.containDeep(updatedAccountSetting);
  });
});

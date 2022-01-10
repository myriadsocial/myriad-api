import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../..';
import {AccountSettingType} from '../../enums';
import {AccountSetting, Credential, User} from '../../models';
import {AccountSettingRepository, UserRepository} from '../../repositories';
import {
  givenAccountSetting,
  givenAccountSettingInstance,
  givenAccountSettingRepository,
  givenAddress,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';
import {u8aToHex, numberToHex} from '@polkadot/util';
import {KeyringPair} from '@polkadot/keyring/types';

describe('AccountSettingApplication', () => {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let accountSettingRepository: AccountSettingRepository;
  let userRepository: UserRepository;
  let nonce: number;
  let user: User;
  let address: KeyringPair;

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
    address = givenAddress();
  });

  beforeEach(async () => {
    await accountSettingRepository.deleteAll();
  });

  after(async () => {
    await userRepository.deleteAll();
  });

  it('gets user nonce', async () => {
    const response = await client.get(`/users/${user.id}/nonce`).expect(200);

    nonce = response.body.nonce;
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

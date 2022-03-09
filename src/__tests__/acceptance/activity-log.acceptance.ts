import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {ActivityLogType, WalletType} from '../../enums';
import {ActivityLog, Credential, User} from '../../models';
import {ActivityLogRepository, UserRepository} from '../../repositories';
import {
  deleteAllRepository,
  givenActivityLogInstance,
  givenActivityLogRepository,
  givenAddress,
  givenMultipleActivityLogInstances,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';
import {u8aToHex, numberToHex} from '@polkadot/util';
import {KeyringPair} from '@polkadot/keyring/types';

describe('ActivityLogApplication', function () {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let userRepository: UserRepository;
  let activityLogRepository: ActivityLogRepository;
  let nonce: number;
  let user: User;
  let address: KeyringPair;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    userRepository = await givenUserRepository(app);
    activityLogRepository = await givenActivityLogRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    address = givenAddress();
  });

  beforeEach(async () => {
    await activityLogRepository.deleteAll();
  });

  after(async () => {
    await deleteAllRepository(app);
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
      walletType: WalletType.POLKADOT,
    });

    const res = await client.post('/login').send(credential).expect(200);
    token = res.body.accessToken;
  });

  context('when dealing with multiple persisted activityLogs', () => {
    let persistedActivityLogs: ActivityLog[];

    beforeEach(async () => {
      persistedActivityLogs = await givenMultipleActivityLogInstances(
        activityLogRepository,
      );
    });

    it('finds all activitiyLogs', async () => {
      const response = await client
        .get('/activity-logs')
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      expect(toJSON(response.body.data)).to.containDeep(
        toJSON(persistedActivityLogs),
      );
    });

    it('queries activityLogs with a filter', async () => {
      const activityLogInProgress = await givenActivityLogInstance(
        activityLogRepository,
        {
          type: ActivityLogType.CREATEPOST,
          userId:
            '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6181c',
        },
      );

      await client
        .get('/activity-logs')
        .set('Authorization', `Bearer ${token}`)
        .query(
          'filter=' +
            JSON.stringify({
              where: {
                userId:
                  '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6181c',
              },
            }),
        )
        .expect(200, {
          data: [toJSON(activityLogInProgress)],
          meta: {
            currentPage: 1,
            itemsPerPage: 1,
            totalItemCount: 1,
            totalPageCount: 1,
          },
        });
    });

    it('exploded filter conditions work', async () => {
      await givenActivityLogInstance(activityLogRepository, {
        type: ActivityLogType.CREATEPOST,
        userId:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618cc',
      });

      const response = await client
        .get('/activity-logs')
        .set('Authorization', `Bearer ${token}`)
        .query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });

  it('includes user in query result', async () => {
    const otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618dc',
    });

    const activityLog = await givenActivityLogInstance(activityLogRepository, {
      type: ActivityLogType.CREATEPOST,
      userId: otherUser.id,
    });

    const filter =
      'filter=' +
      JSON.stringify({
        include: ['user'],
      });

    const response = await client
      .get('/activity-logs')
      .set('Authorization', `Bearer ${token}`)
      .query(filter);

    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0]).to.deepEqual({
      ...toJSON(activityLog),
      user: toJSON(otherUser),
    });
  });
});

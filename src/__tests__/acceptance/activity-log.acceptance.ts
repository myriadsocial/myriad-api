import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {ActivityLogType} from '../../enums';
import {ActivityLog} from '../../models';
import {
  ActivityLogRepository,
  AuthenticationRepository,
  UserRepository,
} from '../../repositories';
import {
  givenActivityLogInstance,
  givenActivityLogRepository,
  givenAuthenticationRepository,
  givenMultipleActivityLogInstances,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';

describe('ActivityLogApplication', function () {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let userRepository: UserRepository;
  let activityLogRepository: ActivityLogRepository;
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
    userRepository = await givenUserRepository(app);
    activityLogRepository = await givenActivityLogRepository(app);
    authenticationRepository = await givenAuthenticationRepository(app);
  });

  after(async () => {
    await authenticationRepository.deleteAll();
  });

  beforeEach(async () => {
    await userRepository.deleteAll();
    await activityLogRepository.deleteAll();
  });

  it('sign up successfully', async () => {
    await client.post('/signup').send(userCredential).expect(200);
  });

  it('user login successfully', async () => {
    const res = await client.post('/login').send(userCredential).expect(200);
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
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618dc',
    });

    const activityLog = await givenActivityLogInstance(activityLogRepository, {
      type: ActivityLogType.CREATEPOST,
      userId: user.id,
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
      user: toJSON(user),
    });
  });
});

import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {ActivityLogType} from '../../enums';
import {ActivityLog} from '../../models';
import {ActivityLogRepository, UserRepository} from '../../repositories';
import {
  givenActivityLogInstance,
  givenActivityLogRepository,
  givenMultipleActivityLogInstances,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';

describe('ActivityLogApplication', function () {
  let app: MyriadApiApplication;
  let client: Client;
  let userRepository: UserRepository;
  let activityLogRepository: ActivityLogRepository;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    userRepository = await givenUserRepository(app);
    activityLogRepository = await givenActivityLogRepository(app);
  });

  beforeEach(async () => {
    await userRepository.deleteAll();
    await activityLogRepository.deleteAll();
  });

  context('when dealing with multiple persisted activityLogs', () => {
    let persistedActivityLogs: ActivityLog[];

    beforeEach(async () => {
      persistedActivityLogs = await givenMultipleActivityLogInstances(activityLogRepository);
    });

    it('finds all activitiyLogs', async () => {
      const response = await client.get('/activity-logs').send().expect(200);
      expect(toJSON(response.body.data)).to.containDeep(toJSON(persistedActivityLogs));
    });

    it('queries activityLogs with a filter', async () => {
      const activityLogInProgress = await givenActivityLogInstance(activityLogRepository, {
        type: ActivityLogType.PROFILE,
        message: 'You updated your profile',
        userId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6181c',
      });

      await client
        .get('/activity-logs')
        .query(
          'filter=' +
            JSON.stringify({
              where: {userId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6181c'},
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
        type: ActivityLogType.PROFILE,
        message: 'You updated your profile',
        userId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618cc',
      });

      const response = await client.get('/activity-logs').query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });

  it('includes user in query result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618dc',
    });

    const activityLog = await givenActivityLogInstance(activityLogRepository, {
      type: ActivityLogType.PROFILE,
      message: 'You updated your profile',
      userId: user.id,
    });

    const filter =
      'filter=' +
      JSON.stringify({
        include: ['user'],
      });

    const response = await client.get('/activity-logs').query(filter);

    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0]).to.deepEqual({
      ...toJSON(activityLog),
      user: toJSON(user),
    });
  });
});

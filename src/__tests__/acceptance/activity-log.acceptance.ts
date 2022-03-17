import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {ActivityLogType} from '../../enums';
import {ActivityLog, User} from '../../models';
import {ActivityLogRepository, UserRepository} from '../../repositories';
import {
  deleteAllRepository,
  givenAccesToken,
  givenActivityLogInstance,
  givenActivityLogRepository,
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
  let user: User;

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
    token = await givenAccesToken(user);
  });

  beforeEach(async () => {
    await activityLogRepository.deleteAll();
  });

  after(async () => {
    await deleteAllRepository(app);
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
          userId: user.id,
        },
      );

      await client
        .get('/activity-logs')
        .set('Authorization', `Bearer ${token}`)
        .query(
          'filter=' +
            JSON.stringify({
              where: {
                userId: user.id,
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
        userId: user.id,
      });

      const response = await client
        .get('/activity-logs')
        .set('Authorization', `Bearer ${token}`)
        .query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });

  it('includes user in query result', async () => {
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

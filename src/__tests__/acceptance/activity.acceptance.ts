import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {ActivityLogType} from '../../enums';
import {Activity} from '../../models';
import {ActivityRepository, UserRepository} from '../../repositories';
import {
  givenActivityInstance,
  givenActivityRepository,
  givenMultipleActivityInstances,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('ActivityApplication', function () {
  let app: MyriadApiApplication;
  let client: Client;
  let userRepository: UserRepository;
  let activityRepository: ActivityRepository;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    userRepository = await givenUserRepository(app);
    activityRepository = await givenActivityRepository(app);
  });

  beforeEach(async () => {
    await userRepository.deleteAll();
    await activityRepository.deleteAll();
  });

  context('when dealing with multiple persisted activities', () => {
    let persistedActivities: Activity[];

    beforeEach(async () => {
      persistedActivities = await givenMultipleActivityInstances(activityRepository);
    });

    it('finds all activities', async () => {
      const response = await client.get('/activities').send().expect(200);
      expect(toJSON(response.body.data)).to.containDeep(toJSON(persistedActivities));
    });

    it('queries activities with a filter', async () => {
      const activityInProgress = await givenActivityInstance(activityRepository, {
        type: ActivityLogType.PROFILE,
        message: 'You updated your profile',
        userId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6181c',
      });

      await client
        .get('/activities')
        .query(
          'filter=' +
            JSON.stringify({
              where: {userId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6181c'},
            }),
        )
        .expect(200, {
          data: [toJSON(activityInProgress)],
          meta: {
            currentPage: 1,
            itemsPerPage: 1,
            totalItemCount: 1,
            totalPageCount: 1,
          },
        });
    });

    it('exploded filter conditions work', async () => {
      await givenActivityInstance(activityRepository, {
        type: ActivityLogType.PROFILE,
        message: 'You updated your profile',
        userId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618cc',
      });

      const response = await client.get('/activities').query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });

  it('includes user in query result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618dc',
    });

    const activity = await givenActivityInstance(activityRepository, {
      type: ActivityLogType.PROFILE,
      message: 'You updated your profile',
      userId: user.id,
    });

    const filter =
      'filter=' +
      JSON.stringify({
        include: ['user'],
      });

    const response = await client.get('/activities').query(filter);

    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0]).to.deepEqual({
      ...toJSON(activity),
      user: toJSON(user),
    });
  });
});

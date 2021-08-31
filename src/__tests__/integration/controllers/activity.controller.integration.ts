import {expect} from '@loopback/testlab';
import {ActivityController} from '../../../controllers';
import {ActivityRepository, UserRepository} from '../../../repositories';
import {
  givenActivityInstance,
  givenEmptyDatabase,
  givenRepositories,
  givenUserInstance,
  testdb,
} from '../../helpers';

describe('ActivityControllerIntegration', () => {
  let userRepository: UserRepository;
  let activityRepository: ActivityRepository;
  let controller: ActivityController;

  before(async () => {
    ({userRepository, activityRepository} = await givenRepositories(testdb));
  });

  before(async () => {
    controller = new ActivityController(activityRepository);
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes User in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });

    const activity = await givenActivityInstance(activityRepository, {
      userId: user.id,
    });

    const response = await controller.find({include: ['user']});

    expect(response).to.containDeep([
      {
        ...activity,
        user: user,
      },
    ]);
  });
});

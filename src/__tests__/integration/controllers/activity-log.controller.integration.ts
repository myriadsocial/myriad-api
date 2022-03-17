import {expect} from '@loopback/testlab';
import {ActivityLogController} from '../../../controllers';
import {ActivityLogRepository, UserRepository} from '../../../repositories';
import {
  givenActivityLogInstance,
  givenEmptyDatabase,
  givenRepositories,
  givenUserInstance,
  testdb,
} from '../../helpers';

describe('ActivityLogControllerIntegration', () => {
  let userRepository: UserRepository;
  let activityLogRepository: ActivityLogRepository;
  let controller: ActivityLogController;

  before(async () => {
    ({userRepository, activityLogRepository} = await givenRepositories(testdb));
  });

  before(async () => {
    controller = new ActivityLogController(activityLogRepository);
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes User in find method result', async () => {
    const user = await givenUserInstance(userRepository);

    const activityLog = await givenActivityLogInstance(activityLogRepository, {
      userId: user.id,
    });

    const response = await controller.find({include: ['user']});

    expect(response).to.containDeep([
      {
        ...activityLog,
        user: user,
      },
    ]);
  });
});

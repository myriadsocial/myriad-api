import {expect} from '@loopback/testlab';
import {ExperienceController} from '../../../controllers';
import {ExperienceRepository, UserRepository} from '../../../repositories';
import {
  givenEmptyDatabase,
  givenExperienceInstance,
  givenRepositories,
  givenUserInstance,
  testdb,
} from '../../helpers';

describe('ExperienceControllerIntegration', () => {
  let userRepository: UserRepository;
  let experienceRepository: ExperienceRepository;
  let controller: ExperienceController;

  before(async () => {
    ({userRepository, experienceRepository} = await givenRepositories(testdb));
  });

  before(async () => {
    controller = new ExperienceController(experienceRepository);
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes User in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });

    const experience = await givenExperienceInstance(experienceRepository, {
      createdBy: user.id,
    });

    const response = await controller.find({include: ['user']});

    expect(response).to.containDeep([
      {
        ...experience,
        user: user,
      },
    ]);
  });

  it('includes User in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });

    const experience = await givenExperienceInstance(experienceRepository, {
      createdBy: user.id,
    });
    const response = await controller.findById(experience.id ?? '', {
      include: ['user'],
    });

    expect(response).to.containDeep({
      ...experience,
      user: user,
    });
  });
});

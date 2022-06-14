import {expect} from '@loopback/testlab';
import {ExperienceController} from '../../../controllers';
import {ExperienceRepository, UserRepository} from '../../../repositories';
import {ExperienceService} from '../../../services';
import {
  givenEmptyDatabase,
  givenExperienceInstance,
  givenRepositories,
  givenUserInstance,
  testDBMongo,
} from '../../helpers';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('ExperienceControllerIntegration', function () {
  this.timeout(100000);

  let userRepository: UserRepository;
  let experienceRepository: ExperienceRepository;
  let experienceService: ExperienceService;
  let controller: ExperienceController;

  before(async () => {
    ({userRepository, experienceRepository, experienceService} =
      await givenRepositories(testDBMongo));
  });

  before(async () => {
    controller = new ExperienceController(
      experienceRepository,
      experienceService,
    );
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testDBMongo);
  });

  it('includes User in find method result', async () => {
    const user = await givenUserInstance(userRepository);
    const experience = await givenExperienceInstance(experienceRepository, {
      createdBy: user.id,
    });

    user.id = user.id.toString();
    experience.id = experience.id?.toString();

    const response = await controller.find({include: ['user']});

    expect(response).to.containDeep([
      {
        ...experience,
        user: user,
      },
    ]);
  });

  it('includes User in findById method result', async () => {
    const user = await givenUserInstance(userRepository);
    const experience = await givenExperienceInstance(experienceRepository, {
      createdBy: user.id,
    });

    user.id = user.id.toString();
    experience.id = experience.id?.toString();

    const response = await controller.findById(experience.id ?? '', {
      include: ['user'],
    });

    expect(response).to.containDeep({
      ...experience,
      user: user,
    });
  });
});

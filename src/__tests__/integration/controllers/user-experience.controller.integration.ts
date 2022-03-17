import {expect} from '@loopback/testlab';
import {UserExperienceController} from '../../../controllers';
import {
  ExperienceRepository,
  UserExperienceRepository,
  UserRepository,
} from '../../../repositories';
import {
  givenEmptyDatabase,
  givenExperienceInstance,
  givenRepositories,
  givenUserExperienceInstance,
  givenUserInstance,
  testdb,
} from '../../helpers';

describe('UserExperienceControllerIntegration', () => {
  let userRepository: UserRepository;
  let experienceRepository: ExperienceRepository;
  let userExperienceRepository: UserExperienceRepository;
  let controller: UserExperienceController;

  before(async () => {
    ({userRepository, experienceRepository, userExperienceRepository} =
      await givenRepositories(testdb));
  });

  before(async () => {
    controller = new UserExperienceController(
      userRepository,
      userExperienceRepository,
      experienceRepository,
    );
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes User in find method result', async () => {
    const user = await givenUserInstance(userRepository);

    const userExperience = await givenUserExperienceInstance(
      userExperienceRepository,
      {
        userId: user.id,
      },
    );

    const response = await controller.find({include: ['user']});

    expect(response).to.containDeep([
      {
        ...userExperience,
        user: user,
      },
    ]);
  });

  it('includes Experience in find method result', async () => {
    const user = await givenUserInstance(userRepository);

    const experience = await givenExperienceInstance(experienceRepository, {
      createdBy: user.id,
    });

    const userExperience = await givenUserExperienceInstance(
      userExperienceRepository,
      {
        experienceId: experience.id,
      },
    );

    const response = await controller.find({include: ['experience']});

    expect(response).to.containDeep([
      {
        ...userExperience,
        experience: experience,
      },
    ]);
  });

  it('includes both User and Experience in find method result', async () => {
    const user = await givenUserInstance(userRepository);

    const experience = await givenExperienceInstance(experienceRepository, {
      createdBy: user.id,
    });

    const userExperience = await givenUserExperienceInstance(
      userExperienceRepository,
      {
        userId: user.id,
        experienceId: experience.id,
      },
    );

    const response = await controller.find({include: ['user', 'experience']});

    expect(response).to.containDeep([
      {
        ...userExperience,
        user: user,
        experience: experience,
      },
    ]);
  });

  it('includes User in findById method result', async () => {
    const user = await givenUserInstance(userRepository);

    const userExperience = await givenUserExperienceInstance(
      userExperienceRepository,
      {
        userId: user.id,
      },
    );

    const response = await controller.findById(userExperience.id, {
      include: ['user'],
    });

    expect(response).to.containDeep({
      ...userExperience,
      user: user,
    });
  });

  it('includes Experience in findById method result', async () => {
    const user = await givenUserInstance(userRepository);

    const experience = await givenExperienceInstance(experienceRepository, {
      createdBy: user.id,
    });

    const userExperience = await givenUserExperienceInstance(
      userExperienceRepository,
      {
        experienceId: experience.id,
      },
    );

    const response = await controller.findById(userExperience.id, {
      include: ['experience'],
    });

    expect(response).to.containDeep({
      ...userExperience,
      experience: experience,
    });
  });

  it('includes both User and Experience in findById method result', async () => {
    const user = await givenUserInstance(userRepository);

    const experience = await givenExperienceInstance(experienceRepository, {
      createdBy: user.id,
    });

    const userExperience = await givenUserExperienceInstance(
      userExperienceRepository,
      {
        userId: user.id,
        experienceId: experience.id,
      },
    );

    const response = await controller.findById(userExperience.id, {
      include: ['user', 'experience'],
    });

    expect(response).to.containDeep({
      ...userExperience,
      user: user,
      experience: experience,
    });
  });
});

import {expect, toJSON} from '@loopback/testlab';
import {UserSocialMediaController} from '../../../controllers';
import {
  PeopleRepository,
  UserRepository,
  UserSocialMediaRepository,
} from '../../../repositories';
import {UserService} from '../../../services';
import {
  givenEmptyDatabase,
  givenPeopleInstance,
  givenRepositories,
  givenUserInstance,
  givenUserSocialMediaInstance,
  testdb,
} from '../../helpers';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('UserSocialMediaControllerIntegration', function () {
  this.timeout(10000);

  let userSocialMediaRepository: UserSocialMediaRepository;
  let peopleRepository: PeopleRepository;
  let userRepository: UserRepository;
  let userService: UserService;
  let controller: UserSocialMediaController;

  before(async () => {
    ({
      userSocialMediaRepository,
      peopleRepository,
      userRepository,
      userSocialMediaRepository,
      userService,
    } = await givenRepositories(testdb));
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  before(async () => {
    controller = new UserSocialMediaController(userService);
  });

  it('includes User in find method result', async () => {
    const user = await givenUserInstance(userRepository);
    const userSocialMedia = await givenUserSocialMediaInstance(
      userSocialMediaRepository,
      {
        userId: user.id,
      },
    );

    const response = await controller.find({include: ['user']});

    expect(toJSON(response)).to.containDeep(
      toJSON([
        {
          ...userSocialMedia,
          user: user,
        },
      ]),
    );
  });

  it('includes People in find method result', async () => {
    const people = await givenPeopleInstance(peopleRepository);
    const userSocialMedia = await givenUserSocialMediaInstance(
      userSocialMediaRepository,
      {
        peopleId: people.id,
      },
    );

    const response = await controller.find({include: ['people']});

    expect(toJSON(response)).to.containDeep(
      toJSON([
        {
          ...userSocialMedia,
          people: toJSON(people),
        },
      ]),
    );
  });

  it('includes both User and People in find method result', async () => {
    const user = await givenUserInstance(userRepository);
    const people = await givenPeopleInstance(peopleRepository);
    const userSocialMedia = await givenUserSocialMediaInstance(
      userSocialMediaRepository,
      {
        peopleId: people.id,
        userId: user.id,
      },
    );

    const response = await controller.find({include: ['user', 'people']});

    expect(toJSON(response)).to.containDeep(
      toJSON([
        {
          ...userSocialMedia,
          user: toJSON(user),
          people: toJSON(people),
        },
      ]),
    );
  });
});

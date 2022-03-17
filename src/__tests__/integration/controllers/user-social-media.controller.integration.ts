import {expect, toJSON} from '@loopback/testlab';
import {UserSocialMediaController} from '../../../controllers';
import {RedditDataSource} from '../../../datasources';
import {
  PeopleRepository,
  UserRepository,
  UserSocialMediaRepository,
} from '../../../repositories';
import {
  Facebook,
  NotificationService,
  Reddit,
  RedditProvider,
  SocialMediaService,
  Twitter,
  UserSocialMediaService,
} from '../../../services';
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
  let userSocialMediaService: UserSocialMediaService;
  let socialMediaService: SocialMediaService;
  let twitterService: Twitter;
  let redditService: Reddit;
  let facebookService: Facebook;
  let peopleRepository: PeopleRepository;
  let notificationService: NotificationService;
  let userRepository: UserRepository;
  let controller: UserSocialMediaController;

  before(async () => {
    ({
      userSocialMediaRepository,
      peopleRepository,
      userRepository,
      userSocialMediaRepository,
      notificationService,
      userSocialMediaService,
    } = await givenRepositories(testdb));
  });

  before(givenRedditService);

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  before(async () => {
    socialMediaService = new SocialMediaService(
      peopleRepository,
      twitterService,
      redditService,
      facebookService,
    );
    controller = new UserSocialMediaController(
      socialMediaService,
      userSocialMediaService,
      notificationService,
    );
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

  it('includes User in findById method result', async () => {
    const user = await givenUserInstance(userRepository);
    const userSocialMedia = await givenUserSocialMediaInstance(
      userSocialMediaRepository,
      {
        userId: user.id,
      },
    );

    const response = await controller.findById(userSocialMedia.id, {
      include: ['user'],
    });

    expect(toJSON(response)).to.containDeep(
      toJSON({
        ...userSocialMedia,
        user: toJSON(user),
      }),
    );
  });

  it('includes People in findById method result', async () => {
    const people = await givenPeopleInstance(peopleRepository);
    const userSocialMedia = await givenUserSocialMediaInstance(
      userSocialMediaRepository,
      {
        peopleId: people.id,
      },
    );

    const response = await controller.findById(userSocialMedia.id, {
      include: ['people'],
    });

    expect(toJSON(response)).to.containDeep(
      toJSON({
        ...userSocialMedia,
        people: toJSON(people),
      }),
    );
  });

  it('includes both User and People in findById method result', async () => {
    const user = await givenUserInstance(userRepository);
    const people = await givenPeopleInstance(peopleRepository);
    const userSocialMedia = await givenUserSocialMediaInstance(
      userSocialMediaRepository,
      {
        peopleId: people.id,
        userId: user.id,
      },
    );

    const response = await controller.findById(userSocialMedia.id, {
      include: ['user', 'people'],
    });

    expect(toJSON(response)).to.containDeep(
      toJSON({
        ...userSocialMedia,
        user: toJSON(user),
        people: toJSON(people),
      }),
    );
  });

  async function givenRedditService() {
    const dataSource = new RedditDataSource();
    redditService = await new RedditProvider(dataSource).value();
  }
});

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
  givenUserVerification,
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
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
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
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
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
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
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
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
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

  it('verifies reddit social media', async () => {
    await givenUserInstance(userRepository, {
      id: '0x48c145fb4a5aeb32075023a576180107ecc1e5470ab2ebdd1965b71a33dad363',
    });

    const userVerification = givenUserVerification({
      publicKey:
        '0x48c145fb4a5aeb32075023a576180107ecc1e5470ab2ebdd1965b71a33dad363',
    });
    const platformUser = await socialMediaService.verifyToReddit(
      userVerification.username,
      userVerification.publicKey,
    );
    const userSocialMedia = await userSocialMediaService.createSocialMedia(
      platformUser,
    );

    const response = await controller.find();

    expect(toJSON(response)).to.containDeep([toJSON(userSocialMedia)]);
  });

  async function givenRedditService() {
    const dataSource = new RedditDataSource();
    redditService = await new RedditProvider(dataSource).value();
  }
});

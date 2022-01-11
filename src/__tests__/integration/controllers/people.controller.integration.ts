import {expect} from '@loopback/testlab';
import {PeopleController} from '../../../controllers';
import {
  FriendRepository,
  PeopleRepository,
  PostRepository,
  UserRepository,
  UserSocialMediaRepository,
} from '../../../repositories';
import {
  givenEmptyDatabase,
  givenPeopleInstance,
  givenPostInstance,
  givenRepositories,
  givenUserSocialMediaInstance,
  testdb,
} from '../../helpers';
import {securityId} from '@loopback/security';

describe('PeopleControllerIntegration', () => {
  let peopleRepository: PeopleRepository;
  let userSocialMediaRepository: UserSocialMediaRepository;
  let userRepository: UserRepository;
  let postRepository: PostRepository;
  let friendRepository: FriendRepository;
  let controller: PeopleController;

  before(async () => {
    ({
      peopleRepository,
      userSocialMediaRepository,
      postRepository,
      userRepository,
      friendRepository,
    } = await givenRepositories(testdb));
  });

  before(async () => {
    controller = new PeopleController(
      peopleRepository,
      userRepository,
      friendRepository,
      {[securityId]: ''},
    );
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes post in find method result', async () => {
    const people = await givenPeopleInstance(peopleRepository);
    const post = await givenPostInstance(postRepository, {peopleId: people.id});

    const response = await controller.find({include: ['posts']});

    expect(response).to.containDeep([
      {
        ...people,
        posts: [post],
      },
    ]);
  });

  it('includes userSocialMedia in find method result', async () => {
    const people = await givenPeopleInstance(peopleRepository);
    const userSocialMedia = await givenUserSocialMediaInstance(
      userSocialMediaRepository,
      {
        peopleId: people.id,
      },
    );
    const response = await controller.find({include: ['userSocialMedia']});

    expect(response).to.containDeep([
      {
        ...people,
        userSocialMedia: userSocialMedia,
      },
    ]);
  });

  it('includes both posts and userSocialMedia in find method result', async () => {
    const people = await givenPeopleInstance(peopleRepository);
    const post = await givenPostInstance(postRepository, {peopleId: people.id});
    const userSocialMedia = await givenUserSocialMediaInstance(
      userSocialMediaRepository,
      {
        peopleId: people.id,
      },
    );

    const response = await controller.find({
      include: ['posts', 'userSocialMedia'],
    });

    expect(response).to.containDeep([
      {
        ...people,
        posts: [post],
        userSocialMedia: userSocialMedia,
      },
    ]);
  });

  it('includes post in findById method result', async () => {
    const people = await givenPeopleInstance(peopleRepository);
    const post = await givenPostInstance(postRepository, {peopleId: people.id});

    const response = await controller.findById(people.id, {include: ['posts']});

    expect(response).to.containDeep({
      ...people,
      posts: [post],
    });
  });

  it('includes userSocialMedia in findById method result', async () => {
    const people = await givenPeopleInstance(peopleRepository);
    const userSocialMedia = await givenUserSocialMediaInstance(
      userSocialMediaRepository,
      {
        peopleId: people.id,
      },
    );
    const response = await controller.findById(people.id, {
      include: ['userSocialMedia'],
    });

    expect(response).to.containDeep({
      ...people,
      userSocialMedia: userSocialMedia,
    });
  });

  it('includes both posts and userSocialMedia in findById method result', async () => {
    const people = await givenPeopleInstance(peopleRepository);
    const post = await givenPostInstance(postRepository, {peopleId: people.id});
    const userSocialMedia = await givenUserSocialMediaInstance(
      userSocialMediaRepository,
      {
        peopleId: people.id,
      },
    );

    const response = await controller.findById(people.id, {
      include: ['posts', 'userSocialMedia'],
    });

    expect(response).to.containDeep({
      ...people,
      posts: [post],
      userSocialMedia: userSocialMedia,
    });
  });
});

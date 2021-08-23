import {expect} from '@loopback/testlab';
import {PeopleController} from '../../../controllers';
import {PeopleRepository, PostRepository, UserSocialMediaRepository} from '../../../repositories';
import {
  givenEmptyDatabase,
  givenPeopleInstance,
  givenPostInstance,
  givenRepositories,
  givenUserSocialMediaInstance,
} from '../../helpers';

describe('PeopleControllerIntegration', () => {
  let peopleRepository: PeopleRepository;
  let userSocialMediaRepository: UserSocialMediaRepository;
  let postRepository: PostRepository;
  let controller: PeopleController;

  before(async () => {
    ({peopleRepository, userSocialMediaRepository, postRepository} = await givenRepositories());
  });

  before(async () => {
    controller = new PeopleController(peopleRepository);
  });

  beforeEach(givenEmptyDatabase);

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
    const userSocialMedia = await givenUserSocialMediaInstance(userSocialMediaRepository, {
      peopleId: people.id,
    });
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
    const userSocialMedia = await givenUserSocialMediaInstance(userSocialMediaRepository, {
      peopleId: people.id,
    });

    const response = await controller.find({include: ['posts', 'userSocialMedia']});

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
    const userSocialMedia = await givenUserSocialMediaInstance(userSocialMediaRepository, {
      peopleId: people.id,
    });
    const response = await controller.findById(people.id, {include: ['userSocialMedia']});

    expect(response).to.containDeep({
      ...people,
      userSocialMedia: userSocialMedia,
    });
  });

  it('includes both posts and userSocialMedia in findById method result', async () => {
    const people = await givenPeopleInstance(peopleRepository);
    const post = await givenPostInstance(postRepository, {peopleId: people.id});
    const userSocialMedia = await givenUserSocialMediaInstance(userSocialMediaRepository, {
      peopleId: people.id,
    });

    const response = await controller.findById(people.id, {include: ['posts', 'userSocialMedia']});

    expect(response).to.containDeep({
      ...people,
      posts: [post],
      userSocialMedia: userSocialMedia,
    });
  });
});

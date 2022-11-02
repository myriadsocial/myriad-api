import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {Experience, Post, User} from '../../models';
import {
  ExperiencePostRepository,
  ExperienceRepository,
  PostRepository,
  UserRepository,
} from '../../repositories';
import {
  givenExperienceRepository,
  givenUserRepository,
  givenExperiencePostRepository,
  setupApplication,
  givenPostRepository,
  givenUserInstance,
  givenAccesToken,
  deleteAllRepository,
  givenPostInstance,
  givenMultipleExperienceInstances,
} from '../helpers';

describe('ExperiencePostApplication', () => {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let experienceRepository: ExperienceRepository;
  let experiencePostRepository: ExperiencePostRepository;
  let userRepository: UserRepository;
  let postRepository: PostRepository;
  let user: User;
  let post: Post;
  let experiences: Experience[];

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    userRepository = await givenUserRepository(app);
    experienceRepository = await givenExperienceRepository(app);
    experiencePostRepository = await givenExperiencePostRepository(app);
    postRepository = await givenPostRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    post = await givenPostInstance(postRepository, {createdBy: user.id});
    experiences = await givenMultipleExperienceInstances(
      experienceRepository,
      user.id,
    );
    token = await givenAccesToken(user);
  });

  beforeEach(async () => {
    await experiencePostRepository.deleteAll();
  });

  after(async () => {
    await deleteAllRepository(app);
  });

  it('adds post to experience', async () => {
    const data = {
      experienceIds: [experiences[0].id],
      postId: post.id,
    };
    const response = await client
      .post(`/experiences/post`)
      .set('Authorization', `Bearer ${token}`)
      .send(data)
      .expect(200);
    expect(response.body).to.containDeep([
      {experienceId: experiences[0].id, postId: post.id},
    ]);
    const result = await experiencePostRepository.findById(response.body[0].id);
    expect(result).to.containDeep({
      experienceId: experiences[0].id,
      postId: post.id,
    });
  });

  it('delete experience from post', async () => {
    const experiencePost = await experiencePostRepository.create({
      experienceId: experiences[0].id,
      postId: post.id,
    });

    await client
      .del(`/experience/${experiences[0].id}/post/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send()
      .expect(200);

    await expect(
      experiencePostRepository.findById(experiencePost.id),
    ).to.be.rejectedWith(EntityNotFoundError);
  });
});

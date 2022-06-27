import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
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
  givenExperienceInstance,
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
    const response = await client
      .post(`/experiences/${experiences[0].id}/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send()
      .expect(200);
    const data = {
      experienceId: experiences[0].id,
      postId: post.id,
    };
    expect(response.body).to.containDeep(data);
    const result = await experiencePostRepository.findById(response.body.id);
    expect(result).to.containDeep(data);
  });

  it('returns 401 when adding a post to experience not as login user', async () => {
    const experience = await givenExperienceInstance(experienceRepository);

    await client
      .post(`/experiences/${experience.id}/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send()
      .expect(401);
  });

  it('delete experience from post', async () => {
    const experiencePost = await experiencePostRepository.create({
      experienceId: experiences[0].id,
      postId: post.id,
    });

    await client
      .del(`/experiences/${experiences[0].id}/posts/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send()
      .expect(204);

    await expect(
      experiencePostRepository.findById(experiencePost.id),
    ).to.be.rejectedWith(EntityNotFoundError);
  });

  it('adds post to multiple experiences', async () => {
    const newExperience = await givenExperienceInstance(experienceRepository, {
      createdBy: user.id,
    });

    await experiencePostRepository.create({
      experienceId: experiences[0].id,
      postId: post.id,
    });

    const response = await client
      .post(`/experiences/post/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send([experiences[1].id, newExperience.id])
      .expect(200);

    const experiencePosts = await experiencePostRepository.find();
    expect(response.body).to.containDeep(toJSON(experiencePosts));
  });

  it('returns 401 when adding post to multiple experiences that not belong to user', async () => {
    const experience = await givenExperienceInstance(experienceRepository);

    await client
      .post(`/experiences/post/${post.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send([experiences[1].id, experience.id])
      .expect(401);
  });
});

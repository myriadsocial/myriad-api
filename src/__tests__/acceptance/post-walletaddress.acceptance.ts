import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {PlatformType} from '../../enums';
import {People, Post, UserSocialMedia} from '../../models';
import {PeopleRepository, PostRepository, UserSocialMediaRepository} from '../../repositories';
import {
  givenMyriadPostInstance,
  givenPeopleInstance,
  givenPeopleRepository,
  givenPostInstance,
  givenPostRepository,
  givenUserSocialMediaInstance,
  givenUserSocialMediaRepository,
  setupApplication,
} from '../helpers';

describe('PostWalletAddressApplication', function () {
  let app: MyriadApiApplication;
  let client: Client;
  let postRepository: PostRepository;
  let userSocialMediaRepository: UserSocialMediaRepository;
  let peopleRepository: PeopleRepository;
  let people: People;
  let post: Post;
  let userSocialMedia: UserSocialMedia;
  let myriadPost: Post;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    postRepository = await givenPostRepository(app);
    userSocialMediaRepository = await givenUserSocialMediaRepository(app);
    peopleRepository = await givenPeopleRepository(app);
  });

  beforeEach(async () => {
    post = await givenPostInstance(postRepository);
    people = await givenPeopleInstance(peopleRepository);
    userSocialMedia = await givenUserSocialMediaInstance(userSocialMediaRepository, {peopleId: ''});
    myriadPost = await givenMyriadPostInstance(postRepository, {platform: PlatformType.MYRIAD});
  });

  it('gets a post wallet address from people', async () => {
    await postRepository.updateById(post.id, {peopleId: people.id});
    await peopleRepository.updateById(people.id, {
      walletAddress: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61824',
    });
    const result = await client.get(`/posts/${post.id}/walletaddress`).send().expect(200);

    expect(result.body).to.deepEqual({
      walletAddress: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61824',
    });
  });

  it('gets a post wallet address from user', async () => {
    await postRepository.updateById(post.id, {peopleId: people.id});
    await userSocialMediaRepository.updateById(userSocialMedia.id, {peopleId: people.id});
    const result = await client.get(`/posts/${post.id}/walletaddress`).send().expect(200);

    expect(result.body).to.deepEqual({walletAddress: userSocialMedia.userId});
  });

  it('gets a post wallet address if post platform myriad', async () => {
    const result = await client.get(`/posts/${myriadPost.id}/walletaddress`).send().expect(200);

    expect(result.body).to.deepEqual({walletAddress: myriadPost.createdBy});
  });

  it('returns 404 when wallet address not found', async () => {
    await client.get(`/posts/${post.id}/walletaddress`).send().expect(404);
    await postRepository.updateById(post.id, {peopleId: people.id});
    await client.get(`/posts/${post.id}/walletaddress`).send().expect(404);
  });
});

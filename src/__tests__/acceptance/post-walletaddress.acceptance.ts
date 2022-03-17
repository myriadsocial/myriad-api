import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {PlatformType} from '../../enums';
import {People, Post, User, UserSocialMedia} from '../../models';
import {
  PeopleRepository,
  PostRepository,
  UserRepository,
  UserSocialMediaRepository,
} from '../../repositories';
import {
  deleteAllRepository,
  givenAccesToken,
  givenMyriadPostInstance,
  givenPeopleInstance,
  givenPeopleRepository,
  givenPostInstance,
  givenPostRepository,
  givenUserInstance,
  givenUserRepository,
  givenUserSocialMediaInstance,
  givenUserSocialMediaRepository,
  setupApplication,
} from '../helpers';
import {promisify} from 'util';
import {genSalt, hash} from 'bcryptjs';
import {config} from '../../config';
import {PolkadotJs} from '../../utils/polkadotJs-utils';

const jwt = require('jsonwebtoken');
const signAsync = promisify(jwt.sign);

describe('PostWalletAddressApplication', function () {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let postRepository: PostRepository;
  let userSocialMediaRepository: UserSocialMediaRepository;
  let peopleRepository: PeopleRepository;
  let userRepository: UserRepository;
  let people: People;
  let post: Post;
  let userSocialMedia: UserSocialMedia;
  let myriadPost: Post;
  let user: User;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    postRepository = await givenPostRepository(app);
    userSocialMediaRepository = await givenUserSocialMediaRepository(app);
    peopleRepository = await givenPeopleRepository(app);
    userRepository = await givenUserRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    token = await givenAccesToken(user);
  });

  beforeEach(async () => {
    post = await givenPostInstance(postRepository);
    people = await givenPeopleInstance(peopleRepository);
    userSocialMedia = await givenUserSocialMediaInstance(
      userSocialMediaRepository,
      {peopleId: ''},
    );
    myriadPost = await givenMyriadPostInstance(postRepository, {
      platform: PlatformType.MYRIAD,
    });
  });

  after(async () => {
    await deleteAllRepository(app);
  });

  it('gets a post wallet address from people', async () => {
    const password = people.id + config.MYRIAD_ESCROW_SECRET_KEY;
    const salt = await genSalt(10);
    const hashPassword = await hash(password, salt);

    await postRepository.updateById(post.id, {peopleId: people.id});
    await peopleRepository.updateById(people.id, {
      walletAddressPassword: hashPassword,
    });
    const result = await client
      .get(`/posts/${post.id}/walletaddress`)
      .set('Authorization', `Bearer ${token}`)
      .send()
      .expect(200);

    const token1 = await signAsync(
      {
        id: people.id,
        originUserId: people.originUserId,
        platform: people.platform,
        iat: new Date(people.createdAt ?? '').getTime(),
      },
      config.MYRIAD_ESCROW_SECRET_KEY,
    );

    const {getKeyring, getHexPublicKey} = new PolkadotJs();
    const newKey = getKeyring().addFromUri('//' + token1);

    expect(result.body).to.deepEqual({
      walletAddress: getHexPublicKey(newKey),
    });
  });

  it('gets a post wallet address from user', async () => {
    await postRepository.updateById(post.id, {peopleId: people.id});
    await userSocialMediaRepository.updateById(userSocialMedia.id, {
      peopleId: people.id,
    });
    const result = await client
      .get(`/posts/${post.id}/walletaddress`)
      .set('Authorization', `Bearer ${token}`)
      .send()
      .expect(200);

    expect(result.body).to.deepEqual({walletAddress: userSocialMedia.userId});
  });

  it('gets a post wallet address if post platform myriad', async () => {
    const result = await client
      .get(`/posts/${myriadPost.id}/walletaddress`)
      .set('Authorization', `Bearer ${token}`)
      .send()
      .expect(200);

    expect(result.body).to.deepEqual({walletAddress: myriadPost.createdBy});
  });

  it('returns 401 and 404 when wallet address not found', async () => {
    await client
      .get(`/posts/${post.id}/walletaddress`)
      .set('Authorization', `Bearer ${token}`)
      .send()
      .expect(404);
    await postRepository.updateById(post.id, {peopleId: people.id});
    await client
      .get(`/posts/${post.id}/walletaddress`)
      .set('Authorization', `Bearer ${token}`)
      .send()
      .expect(401);
  });
});

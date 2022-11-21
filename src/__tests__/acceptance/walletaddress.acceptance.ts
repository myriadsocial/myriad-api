import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {PlatformType, ReferenceType} from '../../enums';
import {
  People,
  Post,
  Server,
  User,
  UserSocialMedia,
  Wallet,
} from '../../models';
import {
  NetworkRepository,
  PeopleRepository,
  PostRepository,
  ServerRepository,
  UserRepository,
  UserSocialMediaRepository,
  WalletRepository,
} from '../../repositories';
import {
  deleteAllRepository,
  givenAccesToken,
  givenMyriadPostInstance,
  givenNetworkInstance,
  givenNetworkRepository,
  givenOtherUser,
  givenPeopleInstance,
  givenPeopleRepository,
  givenPostInstance,
  givenPostRepository,
  givenServerInstance,
  givenServerRepository,
  givenUserInstance,
  givenUserRepository,
  givenUserSocialMediaInstance,
  givenUserSocialMediaRepository,
  givenWalletInstance,
  givenWalletRepository,
  setupApplication,
} from '../helpers';

describe('WalletAddressApplication', function () {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let postRepository: PostRepository;
  let userSocialMediaRepository: UserSocialMediaRepository;
  let peopleRepository: PeopleRepository;
  let userRepository: UserRepository;
  let walletRepository: WalletRepository;
  let networkRepository: NetworkRepository;
  let serverRepository: ServerRepository;
  let people: People;
  let post: Post;
  let myriadPost: Post;
  let userSocialMedia: UserSocialMedia;
  let user: User;
  let otherUser: User;
  let wallet: Wallet;
  let server: Server;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    postRepository = await givenPostRepository(app);
    userSocialMediaRepository = await givenUserSocialMediaRepository(app);
    peopleRepository = await givenPeopleRepository(app);
    userRepository = await givenUserRepository(app);
    walletRepository = await givenWalletRepository(app);
    networkRepository = await givenNetworkRepository(app);
    serverRepository = await givenServerRepository(app);
  });

  before(async () => {
    server = await givenServerInstance(serverRepository);
    otherUser = await givenUserInstance(userRepository, givenOtherUser());
    user = await givenUserInstance(userRepository);
    token = await givenAccesToken(user);
    wallet = await givenWalletInstance(walletRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
      userId: otherUser.id,
      primary: true,
      networkId: 'polkadot',
    });

    await givenNetworkInstance(networkRepository);
    await givenNetworkInstance(networkRepository, {
      id: 'myriad',
      rpcURL: 'wss://ws-rpc.dev.myriad.social',
    });
    await givenWalletInstance(walletRepository, {
      userId: user.id,
      primary: true,
      networkId: 'myriad',
    });
  });

  beforeEach(async () => {
    post = await givenPostInstance(postRepository);
    people = await givenPeopleInstance(peopleRepository);
    userSocialMedia = await givenUserSocialMediaInstance(
      userSocialMediaRepository,
      {peopleId: '', userId: otherUser.id},
    );
    myriadPost = await givenMyriadPostInstance(postRepository, {
      platform: PlatformType.MYRIAD,
      createdBy: otherUser.id,
    });
  });

  after(async () => {
    await deleteAllRepository(app);
  });

  it('gets a post wallet address from people', async () => {
    await postRepository.updateById(post.id, {peopleId: people.id});

    const result = await client
      .get(`/post/${post.id}/walletaddress`)
      .set('Authorization', `Bearer ${token}`)
      .send()
      .expect(200);

    expect(result.body).to.deepEqual({
      serverId: server.accountId['myriad'],
      referenceId: people.id,
      referenceType: ReferenceType.PEOPLE,
    });
  });

  it('gets a post wallet address from user', async () => {
    await postRepository.updateById(post.id, {peopleId: people.id});
    await userSocialMediaRepository.updateById(userSocialMedia.id, {
      peopleId: people.id,
    });
    const result = await client
      .get(`/post/${post.id}/walletaddress`)
      .set('Authorization', `Bearer ${token}`)
      .send()
      .expect(200);

    expect(result.body).to.deepEqual({
      referenceId: wallet.id,
      referenceType: ReferenceType.WALLETADDRESS,
    });
  });

  it('gets a post wallet address if post platform myriad', async () => {
    const result = await client
      .get(`/post/${myriadPost.id}/walletaddress`)
      .set('Authorization', `Bearer ${token}`)
      .send()
      .expect(200);

    expect(result.body).to.deepEqual({
      referenceId: wallet.id,
      referenceType: ReferenceType.WALLETADDRESS,
    });
  });

  it('returns 404 when wallet address not found', async () => {
    await walletRepository.deleteAll();
    await client
      .get(`/post/${post.id}/walletaddress`)
      .set('Authorization', `Bearer ${token}`)
      .send()
      .expect(404);
  });
});

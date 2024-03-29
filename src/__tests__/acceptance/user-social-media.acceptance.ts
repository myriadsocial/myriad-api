import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {PlatformType} from '../../enums';
import {SocialMediaVerificationDto, User, UserSocialMedia} from '../../models';
import {
  IdentityRepository,
  PeopleRepository,
  UserRepository,
  UserSocialMediaRepository,
  WalletRepository,
} from '../../repositories';
import {
  deleteAllRepository,
  givenAccesToken,
  givenIdentityInstance,
  givenIdentityRepository,
  givenOtherUser,
  givenPeopleInstance,
  givenPeopleRepository,
  givenUserInstance,
  givenUserRepository,
  givenUserSocialMediaInstance,
  givenUserSocialMediaRepository,
  givenUserVerification,
  givenWalletInstance,
  givenWalletRepository,
  setupApplication,
} from '../helpers';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('UserSocialMediaApplication', function () {
  this.timeout(20000);

  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let userRepository: UserRepository;
  let peopleRepository: PeopleRepository;
  let userSocialMediaRepository: UserSocialMediaRepository;
  let walletRepository: WalletRepository;
  let identityRepository: IdentityRepository;
  let user: User;
  let otherUser: User;

  const publicKey =
    '0x48c145fb4a5aeb32075023a576180107ecc1e5470ab2ebdd1965b71a33dad363';

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    userRepository = await givenUserRepository(app);
    peopleRepository = await givenPeopleRepository(app);
    userSocialMediaRepository = await givenUserSocialMediaRepository(app);
    walletRepository = await givenWalletRepository(app);
    identityRepository = await givenIdentityRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    otherUser = await givenUserInstance(userRepository, givenOtherUser());
    token = await givenAccesToken(user);

    await givenWalletInstance(walletRepository, {userId: user.id});
    await givenIdentityInstance(identityRepository, {
      userId: user.id,
      hash: publicKey,
    });
    await givenIdentityInstance(identityRepository, {
      userId: otherUser.id,
      hash: publicKey,
    });
  });

  after(async () => {
    await deleteAllRepository(app);
  });

  beforeEach(async () => {
    await peopleRepository.deleteAll();
    await userSocialMediaRepository.deleteAll();
  });

  context('when claiming social medias', () => {
    beforeEach(async () => {
      await userSocialMediaRepository.deleteAll();
    });

    it('verifies user social media', async () => {
      const userVerification = givenUserVerification({address: publicKey});
      const response = await client
        .post('/user/social-medias/verify')
        .set('Authorization', `Bearer ${token}`)
        .send(userVerification)
        .expect(200);
      const result = await userSocialMediaRepository.findById(response.body.id);
      expect({
        id: result.id,
        verified: result.verified,
        platform: result.platform,
      }).to.containDeep({
        id: response.body.id,
        verified: response.body.verified,
        platform: response.body.platform,
      });
    });

    it('rejects user to verify non existing social media', async () => {
      const userVerification: Partial<SocialMediaVerificationDto> =
        givenUserVerification({address: publicKey});
      delete userVerification.platform;

      await client
        .post('/user/social-medias/verify')
        .set('Authorization', `Bearer ${token}`)
        .send(userVerification)
        .expect(404);
    });

    it('rejects user to verify non existing social media username', async () => {
      const userVerification = givenUserVerification({
        address: publicKey,
        username: 'kemrenwebrge',
      });

      await client
        .post('/user/social-medias/verify')
        .set('Authorization', `Bearer ${token}`)
        .send(userVerification)
        .expect(404);
    });
  });

  context('when dealing with a single persisted user social media', () => {
    it('deletes the user social media', async () => {
      await givenIdentityInstance(identityRepository, {
        userId: user.id,
        hash: publicKey,
      });

      const userVerification = givenUserVerification({address: publicKey});
      const response = await client
        .post('/user/social-medias/verify')
        .set('Authorization', `Bearer ${token}`)
        .send(userVerification)
        .expect(200);

      await client
        .del(`/user/social-medias/${response.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send();
      await expect(
        userSocialMediaRepository.findById(response.body.id),
      ).to.be.rejectedWith(EntityNotFoundError);
    });
  });

  context('when dealing with multiple persisted user social medias', () => {
    let persistedUserSocialMedias: UserSocialMedia[];

    beforeEach(async () => {
      persistedUserSocialMedias = [
        await givenUserSocialMediaInstance(userSocialMediaRepository),
        await givenUserSocialMediaInstance(userSocialMediaRepository, {
          platform: PlatformType.REDDIT,
          peopleId: '2',
        }),
      ];
    });

    it('finds all user social medias', async () => {
      const response = await client
        .get('/user/social-medias')
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      expect(response.body.data).to.containDeep(
        toJSON(persistedUserSocialMedias),
      );
    });

    it('queries users with a filter', async () => {
      const userSocialMediaInProgress = await givenUserSocialMediaInstance(
        userSocialMediaRepository,
        {
          platform: PlatformType.FACEBOOK,
          peopleId: '3',
        },
      );

      await client
        .get('/user/social-medias')
        .set('Authorization', `Bearer ${token}`)
        .query('filter=' + JSON.stringify({where: {peopleId: '3'}}))
        .expect(200, {
          data: [toJSON(userSocialMediaInProgress)],
          meta: {
            currentPage: 1,
            itemsPerPage: 1,
            totalItemCount: 1,
            totalPageCount: 1,
          },
        });
    });

    it('exploded filter conditions work', async () => {
      await givenUserSocialMediaInstance(userSocialMediaRepository, {
        userId: '1',
        platform: PlatformType.REDDIT,
        peopleId: '4',
      });

      const response = await client
        .get('/user/social-medias')
        .set('Authorization', `Bearer ${token}`)
        .query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });

  it('includes friends and currencies in query result', async () => {
    const people = await givenPeopleInstance(peopleRepository);
    const userSocialMedia = await givenUserSocialMediaInstance(
      userSocialMediaRepository,
      {
        userId: user.id,
        peopleId: people.id,
      },
    );

    const filter =
      'filter=' +
      JSON.stringify({
        include: ['user', 'people'],
      });

    const response = await client
      .get('/user/social-medias')
      .set('Authorization', `Bearer ${token}`)
      .query(filter);

    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0]).to.deepEqual({
      ...toJSON(userSocialMedia),
      user: toJSON(user),
      people: toJSON(people),
    });
  });
});

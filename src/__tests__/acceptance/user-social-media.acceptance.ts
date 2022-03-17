import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {PlatformType} from '../../enums';
import {User, UserSocialMedia, UserVerification} from '../../models';
import {
  PeopleRepository,
  UserRepository,
  UserSocialMediaRepository,
  WalletRepository,
} from '../../repositories';
import {
  deleteAllRepository,
  givenAccesToken,
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
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    otherUser = await givenUserInstance(userRepository, givenOtherUser());
    token = await givenAccesToken(user);

    await givenWalletInstance(walletRepository, {userId: user.id});
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
      const userVerification = givenUserVerification({publicKey: publicKey});
      const response = await client
        .post('/user-social-medias/verify')
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
      const userVerification: Partial<UserVerification> = givenUserVerification(
        {publicKey: publicKey},
      );
      delete userVerification.platform;

      await client
        .post('/user-social-medias/verify')
        .set('Authorization', `Bearer ${token}`)
        .send(userVerification)
        .expect(422);
    });

    it('rejects user to verify non existing social media username', async () => {
      const userVerification = givenUserVerification({
        publicKey: publicKey,
        username: 'kemrenwebrge',
      });

      await client
        .post('/user-social-medias/verify')
        .set('Authorization', `Bearer ${token}`)
        .send(userVerification)
        .expect(404);
    });

    it('rejects user to verify social media that is not belong to user', async () => {
      const accessToken = await givenAccesToken(otherUser);
      const userVerification = givenUserVerification({
        publicKey: publicKey,
      });

      await client
        .post('/user-social-medias/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(userVerification)
        .expect(401);
    });

    it('rejects user to verify social media that already been claimed', async () => {
      const userVerification = givenUserVerification({publicKey: publicKey});

      await client
        .post('/user-social-medias/verify')
        .set('Authorization', `Bearer ${token}`)
        .send(userVerification)
        .expect(200);
      await client
        .post('/user-social-medias/verify')
        .set('Authorization', `Bearer ${token}`)
        .send(userVerification)
        .expect(422);
    });
  });

  context('when dealing with a single persisted user social media', () => {
    let persistedUserSocialMedia: UserSocialMedia;

    beforeEach(async () => {
      persistedUserSocialMedia = await givenUserSocialMediaInstance(
        userSocialMediaRepository,
      );
    });

    it('gets a user social media by ID', async () => {
      const result = await client
        .get(`/user-social-medias/${persistedUserSocialMedia.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      const expected = toJSON(persistedUserSocialMedia);

      expect(result.body).to.deepEqual(expected);
    });

    it('returns 404 when getting a user social media that does not exist', () => {
      return client
        .get('/user-social-medias/99999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('returns 401 when deleting the user social media not as login user', async () => {
      const accessToken = await givenAccesToken(otherUser);
      const userVerification = givenUserVerification({publicKey: publicKey});
      const response = await client
        .post('/user-social-medias/verify')
        .set('Authorization', `Bearer ${token}`)
        .send(userVerification)
        .expect(200);

      await client
        .del(`/user-social-medias/${response.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(401);
    });

    it('deletes the user social media', async () => {
      const userVerification = givenUserVerification({publicKey: publicKey});
      const response = await client
        .post('/user-social-medias/verify')
        .set('Authorization', `Bearer ${token}`)
        .send(userVerification)
        .expect(200);

      await client
        .del(`/user-social-medias/${response.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(204);
      await expect(
        userSocialMediaRepository.findById(response.body.id),
      ).to.be.rejectedWith(EntityNotFoundError);
    });

    it('returns 404 when deleting a user social media that does not exist', async () => {
      await client
        .del(`/user-social-medias/99999`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
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
        .get('/user-social-medias')
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
        .get('/user-social-medias')
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
        .get('/user-social-medias')
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
      .get('/user-social-medias')
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

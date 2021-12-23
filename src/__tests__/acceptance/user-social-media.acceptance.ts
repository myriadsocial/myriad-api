import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {PlatformType} from '../../enums';
import {UserSocialMedia, UserVerification} from '../../models';
import {
  PeopleRepository,
  UserRepository,
  UserSocialMediaRepository,
  AuthenticationRepository,
  WalletRepository,
} from '../../repositories';
import {
  givenPeopleInstance,
  givenPeopleRepository,
  givenUserInstance,
  givenUserRepository,
  givenUserSocialMediaInstance,
  givenUserSocialMediaRepository,
  givenAuthenticationRepository,
  givenUserVerification,
  setupApplication,
  givenWalletInstance,
  givenWalletRepository,
} from '../helpers';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('UserSocialMediaApplication', function () {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let userRepository: UserRepository;
  let peopleRepository: PeopleRepository;
  let userSocialMediaRepository: UserSocialMediaRepository;
  let authenticationRepository: AuthenticationRepository;
  let walletRepository: WalletRepository;

  const userCredential = {
    email: 'admin@mail.com',
    password: '123456',
  };

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    authenticationRepository = await givenAuthenticationRepository(app);
    userRepository = await givenUserRepository(app);
    peopleRepository = await givenPeopleRepository(app);
    userSocialMediaRepository = await givenUserSocialMediaRepository(app);
    walletRepository = await givenWalletRepository(app);
  });

  after(async () => {
    await authenticationRepository.deleteAll();
  });

  beforeEach(async () => {
    await userRepository.deleteAll();
    await peopleRepository.deleteAll();
    await userSocialMediaRepository.deleteAll();
    await walletRepository.deleteAll();
  });

  it('sign up successfully', async () => {
    await client.post('/signup').send(userCredential).expect(200);
  });

  it('user login successfully', async () => {
    const res = await client.post('/login').send(userCredential).expect(200);
    token = res.body.accessToken;
  });

  context('when claiming social medias', function () {
    this.timeout(10000);

    beforeEach(async () => {
      await userSocialMediaRepository.deleteAll();
    });

    it('verifies user social media', async () => {
      const user = await givenUserInstance(userRepository);
      const wallet = await givenWalletInstance(walletRepository, {
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ks',
        userId: user.id,
      });
      const userVerification = givenUserVerification({publicKey: wallet.id});
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
      const userVerification: Partial<UserVerification> =
        givenUserVerification();
      delete userVerification.platform;

      await client
        .post('/user-social-medias/verify')
        .set('Authorization', `Bearer ${token}`)
        .send(userVerification)
        .expect(422);
    });

    it('rejects user to verify non existing social media username', async () => {
      const userVerification = givenUserVerification({
        username: 'kemrenwebrge',
      });

      await client
        .post('/user-social-medias/verify')
        .set('Authorization', `Bearer ${token}`)
        .send(userVerification)
        .expect(404);
    });

    it('rejects user to verify social media that is not belong to user', async () => {
      const userVerification = givenUserVerification({
        publicKey:
          '0x06fc711c1a49ad61d7b615d085723aa7d429b621d324a5513b6e54aea442d94e',
      });

      await client
        .post('/user-social-medias/verify')
        .set('Authorization', `Bearer ${token}`)
        .send(userVerification)
        .expect(404);
    });

    it('rejects user to verify social media that already been claimed', async () => {
      const user = await givenUserInstance(userRepository);
      const wallet = await givenWalletInstance(walletRepository, {
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ks',
        userId: user.id,
      });
      const userVerification = givenUserVerification({publicKey: wallet.id});

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

    it('deletes the user social media', async () => {
      await client
        .del(`/user-social-medias/${persistedUserSocialMedia.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(204);
      await expect(
        userRepository.findById(persistedUserSocialMedia.id),
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
        userId:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61861',
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
    const user = await givenUserInstance(userRepository);
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

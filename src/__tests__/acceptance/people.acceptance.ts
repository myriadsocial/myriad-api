import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {PermissionKeys, PlatformType} from '../../enums';
import {Credential, People, User} from '../../models';
import {
  PeopleRepository,
  PostRepository,
  UserRepository,
  UserSocialMediaRepository,
} from '../../repositories';
import {
  givenAddress,
  givenMultiplePeopleInstances,
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
import {u8aToHex, numberToHex} from '@polkadot/util';
import {KeyringPair} from '@polkadot/keyring/types';

describe('PeopleApplication', function () {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let peopleRepository: PeopleRepository;
  let postRepository: PostRepository;
  let userSocialMediaRepository: UserSocialMediaRepository;
  let userRepository: UserRepository;
  let nonce: number;
  let user: User;
  let address: KeyringPair;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    peopleRepository = await givenPeopleRepository(app);
    postRepository = await givenPostRepository(app);
    userSocialMediaRepository = await givenUserSocialMediaRepository(app);
    userRepository = await givenUserRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository, {
      permissions: [PermissionKeys.ADMIN],
    });
    address = givenAddress();
  });

  after(async () => {
    await postRepository.deleteAll();
    await userSocialMediaRepository.deleteAll();
    await userRepository.deleteAll();
  });

  beforeEach(async () => {
    await peopleRepository.deleteAll();
  });

  it('gets user nonce', async () => {
    const response = await client.get(`/users/${user.id}/nonce`).expect(200);

    nonce = response.body.nonce;
  });

  it('user login successfully', async () => {
    const credential: Credential = new Credential({
      nonce: nonce,
      publicAddress: user.id,
      signature: u8aToHex(address.sign(numberToHex(nonce))),
    });

    const res = await client.post('/admin/login').send(credential).expect(200);
    token = res.body.accessToken;
  });

  context('when dealing with a single persisted people', () => {
    let persistedPeople: People;

    beforeEach(async () => {
      persistedPeople = await givenPeopleInstance(peopleRepository);
    });

    it('gets a people by ID', async () => {
      const result = await client
        .get(`/people/${persistedPeople.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      const expected = toJSON(persistedPeople);

      expect(result.body).to.deepEqual(expected);
    });

    it('returns 404 when getting a people that does not exist', () => {
      return client
        .get('/people/99999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('deletes the people', async () => {
      await client
        .del(`/people/${persistedPeople.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(204);
      await expect(
        peopleRepository.findById(persistedPeople.id),
      ).to.be.rejectedWith(EntityNotFoundError);
    });

    it('returns 404 when deleting a people that does not exist', async () => {
      await client
        .del(`/people/99999`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  context('when dealing with multiple persisted people', () => {
    let persistedPeople: People[];

    beforeEach(async () => {
      persistedPeople = await givenMultiplePeopleInstances(peopleRepository);
    });

    it('finds all users', async () => {
      const response = await client
        .get('/people')
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      expect(response.body.data).to.containDeep(toJSON(persistedPeople));
    });

    it('queries people with a filter', async () => {
      const peopleInProgress = await givenPeopleInstance(peopleRepository, {
        name: 'W3F_Bill',
        username: 'W3F_Bill',
        platform: PlatformType.REDDIT,
        originUserId: 't2_5turjfiq',
        profilePictureURL:
          'https://styles.redditmedia.com/t5_2gskf7/styles/profileIcon_snoof1dc48fa-83bd-4ed3-8ef3-56f2469da2ce-headshot.png',
      });

      await client
        .get('/people')
        .set('Authorization', `Bearer ${token}`)
        .query('filter=' + JSON.stringify({where: {name: 'W3F_Bill'}}))
        .expect(200, {
          data: [toJSON(peopleInProgress)],
          meta: {
            currentPage: 1,
            itemsPerPage: 1,
            totalItemCount: 1,
            totalPageCount: 1,
          },
        });
    });

    it('exploded filter conditions work', async () => {
      await givenPeopleInstance(peopleRepository, {
        name: 'CryptoChief',
        username: 'CryptoChief',
        platform: PlatformType.REDDIT,
        originUserId: 't2_e0t5q',
        profilePictureURL:
          'https://www.redditstatic.com/avatars/avatar_default_15_DB0064.png',
      });

      const response = await client
        .get('/people')
        .set('Authorization', `Bearer ${token}`)
        .query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });

  it('includes userSocialMedia and post in query result', async () => {
    const people = await givenPeopleInstance(peopleRepository);
    const userSocialMedia = await givenUserSocialMediaInstance(
      userSocialMediaRepository,
      {
        peopleId: people.id,
      },
    );
    const post = await givenPostInstance(postRepository, {peopleId: people.id});
    const filter = JSON.stringify({include: ['posts', 'userSocialMedia']});

    const response = await client
      .get('/people')
      .set('Authorization', `Bearer ${token}`)
      .query({filter: filter});

    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0]).to.deepEqual({
      ...toJSON(people),
      posts: [toJSON(post)],
      userSocialMedia: toJSON(userSocialMedia),
    });
  });
});

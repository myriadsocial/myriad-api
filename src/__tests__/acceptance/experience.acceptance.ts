import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {Credential, Experience, User} from '../../models';
import {ExperienceRepository, UserRepository} from '../../repositories';
import {
  deleteAllRepository,
  givenAddress,
  givenExperienceInstance,
  givenExperienceRepository,
  givenMultipleExperienceInstances,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';
import {u8aToHex, numberToHex} from '@polkadot/util';
import {KeyringPair} from '@polkadot/keyring/types';

describe('ExperienceApplication', function () {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let experienceRepository: ExperienceRepository;
  let userRepository: UserRepository;
  let nonce: number;
  let user: User;
  let address: KeyringPair;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    userRepository = await givenUserRepository(app);
    experienceRepository = await givenExperienceRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    address = givenAddress();
  });

  beforeEach(async () => {
    await experienceRepository.deleteAll();
  });

  after(async () => {
    await deleteAllRepository(app);
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

    const res = await client.post('/login').send(credential).expect(200);
    token = res.body.accessToken;
  });

  context('when dealing with a single persisted experience', () => {
    let persistedExperience: Experience;

    beforeEach(async () => {
      persistedExperience = await givenExperienceInstance(experienceRepository);
    });

    it('gets a experience by ID', async () => {
      const result = await client
        .get(`/experiences/${persistedExperience.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      const expected = toJSON(persistedExperience);

      expect(result.body).to.deepEqual(expected);
    });

    it('returns 404 when getting a user that does not exist', () => {
      return client
        .get('/experiences/99999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  context('when dealing with multiple persisted experiences', () => {
    let persistedExperiences: Experience[];

    beforeEach(async () => {
      persistedExperiences = await givenMultipleExperienceInstances(
        experienceRepository,
      );
    });

    it('finds all experiences', async () => {
      const response = await client
        .get('/experiences')
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      expect(toJSON(response.body.data)).to.containDeep(
        toJSON(persistedExperiences),
      );
    });

    it('queries users with a filter', async () => {
      const experienceInProgress = await givenExperienceInstance(
        experienceRepository,
        {
          createdBy:
            '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61868',
        },
      );

      await client
        .get('/experiences')
        .set('Authorization', `Bearer ${token}`)
        .query(
          'filter=' +
            JSON.stringify({
              where: {
                createdBy:
                  '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61868',
              },
            }),
        )
        .expect(200, {
          data: [toJSON(experienceInProgress)],
          meta: {
            currentPage: 1,
            itemsPerPage: 1,
            totalItemCount: 1,
            totalPageCount: 1,
          },
        });
    });

    it('exploded filter conditions work', async () => {
      await givenExperienceInstance(experienceRepository);

      const response = await client
        .get('/experiences')
        .set('Authorization', `Bearer ${token}`)
        .query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });

  it('includes user in query result', async () => {
    const experience = await givenExperienceInstance(experienceRepository, {
      createdBy: user.id,
    });

    const filter =
      'filter=' +
      JSON.stringify({
        include: ['user'],
      });

    const response = await client
      .get('/experiences')
      .set('Authorization', `Bearer ${token}`)
      .query(filter);

    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0]).to.deepEqual({
      ...toJSON(experience),
      user: toJSON(user),
    });
  });
});

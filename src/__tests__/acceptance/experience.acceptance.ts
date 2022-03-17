import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {Experience, User} from '../../models';
import {ExperienceRepository, UserRepository} from '../../repositories';
import {
  deleteAllRepository,
  givenAccesToken,
  givenExperienceInstance,
  givenExperienceRepository,
  givenMultipleExperienceInstances,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('ExperienceApplication', function () {
  this.timeout(20000);

  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let experienceRepository: ExperienceRepository;
  let userRepository: UserRepository;
  let user: User;

  before(async () => {
    ({app, client} = await setupApplication(true));
  });

  after(() => app.stop());

  before(async () => {
    userRepository = await givenUserRepository(app);
    experienceRepository = await givenExperienceRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    token = await givenAccesToken(user);
  });

  beforeEach(async () => {
    await experienceRepository.deleteAll();
  });

  after(async () => {
    await deleteAllRepository(app);
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

      expect(result.body).to.deepEqual(
        toJSON({...expected, private: false, friend: false}),
      );
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
          createdBy: user.id,
        },
      );

      await client
        .get('/experiences')
        .set('Authorization', `Bearer ${token}`)
        .query(
          'filter=' +
            JSON.stringify({
              where: {
                createdBy: user.id,
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

import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {UserExperience} from '../../models';
import {
  ExperienceRepository,
  UserExperienceRepository,
  UserRepository,
  AuthenticationRepository,
} from '../../repositories';
import {
  givenExperience,
  givenExperienceInstance,
  givenExperienceRepository,
  givenMultipleUserExperienceInstances,
  givenUserExperience,
  givenUserExperienceInstance,
  givenUserExperienceRepository,
  givenUserInstance,
  givenUserRepository,
  givenAuthenticationRepository,
  setupApplication,
} from '../helpers';

describe('UserExperienceApplication', function () {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let experienceRepository: ExperienceRepository;
  let userRepository: UserRepository;
  let userExperienceRepository: UserExperienceRepository;
  let authenticationRepository: AuthenticationRepository;

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
    experienceRepository = await givenExperienceRepository(app);
    userExperienceRepository = await givenUserExperienceRepository(app);
  });

  after(async () => {
    await authenticationRepository.deleteAll();
  });

  beforeEach(async () => {
    await userRepository.deleteAll();
    await experienceRepository.deleteAll();
    await userExperienceRepository.deleteAll();
  });

  it('sign up successfully', async () => {
    await client.post('/signup').send(userCredential).expect(200);
  });

  it('user login successfully', async () => {
    const res = await client.post('/login').send(userCredential).expect(200);
    token = res.body.accessToken;
  });

  context('when dealing with a single persisted userExperience', () => {
    let persistedUserExperience: UserExperience;

    beforeEach(async () => {
      persistedUserExperience = await givenUserExperienceInstance(
        userExperienceRepository,
      );
    });

    it('gets a userExperience by ID', async () => {
      const result = await client
        .get(`/user-experiences/${persistedUserExperience.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      const expected = toJSON(persistedUserExperience);

      expect(result.body).to.deepEqual(expected);
    });

    it('returns 404 when getting a user that does not exist', () => {
      return client
        .get('/user-experiences/99999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  context('when dealing with multiple persisted experiences', () => {
    let persistedUserExperiences: UserExperience[];

    beforeEach(async () => {
      persistedUserExperiences = await givenMultipleUserExperienceInstances(
        userExperienceRepository,
      );
    });

    it('finds all userExperiences', async () => {
      const response = await client
        .get('/user-experiences')
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      expect(toJSON(response.body.data)).to.containDeep(
        toJSON(persistedUserExperiences),
      );
    });

    it('queries users with a filter', async () => {
      const userExperience = await givenUserExperienceInstance(
        userExperienceRepository,
        {
          subscribed: true,
          experienceId: '3',
          userId:
            '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6184z',
        },
      );

      await client
        .get('/user-experiences')
        .set('Authorization', `Bearer ${token}`)
        .query(
          'filter=' +
            JSON.stringify({
              where: {
                userId:
                  '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6184z',
              },
            }),
        )
        .expect(200, {
          data: [toJSON(userExperience)],
          meta: {
            currentPage: 1,
            itemsPerPage: 1,
            totalItemCount: 1,
            totalPageCount: 1,
          },
        });
    });

    it('exploded filter conditions work', async () => {
      await givenUserExperienceInstance(userExperienceRepository, {
        experienceId: '5',
      });

      const response = await client
        .get('/user-experiences')
        .set('Authorization', `Bearer ${token}`)
        .query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });

  context('when user subscribed an experience', () => {
    beforeEach(async () => {
      await userRepository.deleteAll();
      await experienceRepository.deleteAll();
      await userExperienceRepository.deleteAll();
    });

    it('subscribes other user experience', async () => {
      const user = await givenUserInstance(userRepository);
      const experience = await givenExperienceInstance(experienceRepository);
      const userExperience = givenUserExperience({
        userId: user.id,
        experienceId: experience.id,
        subscribed: true,
      });
      const response = await client
        .post(`/users/${user.id}/subscribe/${experience.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      expect(response.body).to.containDeep(userExperience);

      const result = await userExperienceRepository.findById(response.body.id);
      expect(result).to.containDeep(userExperience);
    });

    it('sets subscribed experience as user default timeline when user experience list is empty', async () => {
      const user = await givenUserInstance(userRepository);
      const experience = await givenExperienceInstance(experienceRepository);
      const response = await client
        .post(`/users/${user.id}/subscribe/${experience.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);

      const expected = {
        ...user,
        onTimeline: response.body.experienceId,
        metric: {
          totalPosts: 0,
          totalKudos: 0,
          totalExperiences: 1,
          totalFriends: 0,
        },
      };

      const result = await userRepository.findById(user.id);

      expect(result).to.containDeep(expected);
    });

    it('rejects subscribe other user experience when experience already belong to user', async () => {
      const user = await givenUserInstance(userRepository);
      const experience = await givenExperienceInstance(experienceRepository, {
        createdBy: user.id,
      });

      await givenUserExperienceInstance(userExperienceRepository, {
        userId: user.id,
        experienceId: experience.id,
        subscribed: false,
      });

      await client
        .post(`/users/${user.id}/subscribe/${experience.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(422);
    });

    it('rejects subscribe other user experience when experience has been subscribed', async () => {
      const user = await givenUserInstance(userRepository);
      const experience = await givenExperienceInstance(experienceRepository);

      await givenUserExperienceInstance(userExperienceRepository, {
        userId: user.id,
        experienceId: experience.id,
        subscribed: true,
      });

      await client
        .post(`/users/${user.id}/subscribe/${experience.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(422);
    });

    it('rejects subscribe other user experience when user has experience more than 10', async () => {
      const user = await givenUserInstance(userRepository);

      for (let i = 0; i < 10; i++) {
        await givenUserExperienceInstance(userExperienceRepository, {
          userId: user.id,
          experienceId: `${i + 1}`,
          subscribed: true,
        });
      }

      const experience = await givenExperienceInstance(experienceRepository);

      await client
        .post(`/users/${user.id}/subscribe/${experience.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(422);
    });
  });

  context('when user create a new experience', () => {
    beforeEach(async () => {
      await userRepository.deleteAll();
      await experienceRepository.deleteAll();
      await userExperienceRepository.deleteAll();
    });

    it('creates an experience and store it in userExperience list', async () => {
      const user = await givenUserInstance(userRepository);
      const experience = givenExperience({createdBy: user.id});
      const response = await client
        .post(`/users/${user.id}/experiences`)
        .set('Authorization', `Bearer ${token}`)
        .send(experience)
        .expect(200);

      expect(response.body).to.containDeep(experience);

      const result = await experienceRepository.findById(response.body.id);
      expect(result).to.containDeep(experience);

      const resulUserExperience = await userExperienceRepository.findOne({
        where: {
          userId: user.id,
          experienceId: response.body.id,
          subscribed: false,
        },
      });

      expect(resulUserExperience).to.containDeep({
        userId: user.id,
        experienceId: result.id,
        subscribed: false,
      });
    });

    it('sets new experience as user default timeline when user experience list is empty', async () => {
      const user = await givenUserInstance(userRepository);
      const experience = givenExperience();
      const response = await client
        .post(`/users/${user.id}/experiences`)
        .set('Authorization', `Bearer ${token}`)
        .send(experience)
        .expect(200);

      const expected = {
        ...user,
        onTimeline: response.body.id,
        metric: {
          totalPosts: 0,
          totalExperiences: 1,
          totalFriends: 0,
          totalKudos: 0,
        },
      };

      const result = await userRepository.findById(user.id);

      expect(result).to.containDeep(expected);
    });

    it('rejects creates new experience when user has experience more than 10', async () => {
      const user = await givenUserInstance(userRepository);

      for (let i = 0; i < 10; i++) {
        await givenUserExperienceInstance(userExperienceRepository, {
          userId: user.id,
          experienceId: `${i + 1}`,
          subscribed: true,
        });
      }

      const experience = givenExperience();

      await client
        .post(`/users/${user.id}/experiences`)
        .set('Authorization', `Bearer ${token}`)
        .send(experience)
        .expect(422);
    });
  });

  it('includes both user and experience in query result', async () => {
    const user = await givenUserInstance(userRepository);
    const experience = await givenExperienceInstance(experienceRepository, {
      createdBy: user.id,
    });

    const userExperience = await givenUserExperienceInstance(
      userExperienceRepository,
      {
        userId: user.id,
        experienceId: experience.id,
      },
    );

    const filter =
      'filter=' +
      JSON.stringify({
        include: ['user', 'experience'],
      });

    const response = await client
      .get('/user-experiences')
      .set('Authorization', `Bearer ${token}`)
      .query(filter);

    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0]).to.deepEqual({
      ...toJSON(userExperience),
      user: toJSON(user),
      experience: toJSON(experience),
    });
  });
});

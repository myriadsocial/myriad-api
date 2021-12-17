import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../..';
import {ReferenceType} from '../../enums';
import {
  ReportRepository,
  UserReportRepository,
  UserRepository,
  AuthenticationRepository,
} from '../../repositories';
import {
  givenReportDetail,
  givenReportRepository,
  givenUserInstance,
  givenUserReportRepository,
  givenUserRepository,
  givenAuthenticationRepository,
  setupApplication,
} from '../helpers';

describe('UserReportApplication', () => {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let reportRepository: ReportRepository;
  let userReportRepository: UserReportRepository;
  let userRepository: UserRepository;
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
    reportRepository = await givenReportRepository(app);
    userReportRepository = await givenUserReportRepository(app);
    userRepository = await givenUserRepository(app);
  });

  after(async () => {
    await authenticationRepository.deleteAll();
  });

  beforeEach(async () => {
    await reportRepository.deleteAll();
    await userReportRepository.deleteAll();
    await userRepository.deleteAll();
  });

  it('sign up successfully', async () => {
    await client.post('/signup').send(userCredential).expect(200);
  });

  it('user login successfully', async () => {
    const res = await client.post('/login').send(userCredential).expect(200);
    token = res.body.accessToken;
  });

  it('creates a report', async () => {
    const user = await givenUserInstance(userRepository);
    const reportedUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61861',
    });
    const reportDetail = givenReportDetail({referenceId: reportedUser.id});
    const response = await client
      .post(`/users/${user.id}/reports`)
      .set('Authorization', `Bearer ${token}`)
      .send(reportDetail)
      .expect(200);
    const result = await reportRepository.findById(response.body.id);
    expect({
      ...response.body,
      totalReported: 1,
    }).to.containDeep(toJSON(result));
    expect(response.body).to.containDeep({
      referenceType: reportDetail.referenceType,
      referenceId: reportDetail.referenceId,
    });

    const [userReportesult] = await userReportRepository.find();
    expect(userReportesult).to.containEql({
      reportedBy: user.id,
      reportId: response.body.id,
      description: reportDetail.description,
    });
  });

  it('rejects reporting a post when type is empty', async () => {
    const reportDetail = givenReportDetail({referenceType: ReferenceType.POST});
    const user = await givenUserInstance(userRepository);
    await client
      .post(`/users/${user.id}/reports`)
      .set('Authorization', `Bearer ${token}`)
      .send(reportDetail)
      .expect(422);
  });
});

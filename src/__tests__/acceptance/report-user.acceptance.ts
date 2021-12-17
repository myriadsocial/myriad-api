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
  givenReportInstance,
  givenReportRepository,
  givenUserInstance,
  givenUserReportInstance,
  givenUserReportRepository,
  givenUserRepository,
  givenAuthenticationRepository,
  setupApplication,
} from '../helpers';

describe('ReportUserApplication', () => {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let reportRepository: ReportRepository;
  let userRepository: UserRepository;
  let userReportRepository: UserReportRepository;
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
    reportRepository = await givenReportRepository(app);
    userReportRepository = await givenUserReportRepository(app);
    userRepository = await givenUserRepository(app);
    authenticationRepository = await givenAuthenticationRepository(app);
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

  it('gets all reporters from a report', async () => {
    const report = await givenReportInstance(reportRepository);
    const reporter = await givenUserInstance(userRepository);
    const userReport = await givenUserReportInstance(userReportRepository, {
      reportId: report.id,
      reportedBy: reporter.id,
      referenceType: ReferenceType.USER,
    });
    const response = await client
      .get(`/reports/${report.id}/users`)
      .set('Authorization', `Bearer ${token}`)
      .send()
      .expect(200);
    expect(response.body.data).to.deepEqual([
      toJSON({
        ...userReport,
        reporter: reporter,
      }),
    ]);
  });
});

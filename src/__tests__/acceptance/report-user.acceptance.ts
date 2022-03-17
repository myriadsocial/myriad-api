import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../..';
import {ReferenceType} from '../../enums';
import {
  ReportRepository,
  UserReportRepository,
  UserRepository,
} from '../../repositories';
import {
  deleteAllRepository,
  givenAccesToken,
  givenReportInstance,
  givenReportRepository,
  givenUserInstance,
  givenUserReportInstance,
  givenUserReportRepository,
  givenUserRepository,
  setupApplication,
} from '../helpers';
import {User} from '../../models';

describe('ReportUserApplication', () => {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let reportRepository: ReportRepository;
  let userRepository: UserRepository;
  let userReportRepository: UserReportRepository;
  let reporter: User;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    reportRepository = await givenReportRepository(app);
    userReportRepository = await givenUserReportRepository(app);
    userRepository = await givenUserRepository(app);
  });

  before(async () => {
    reporter = await givenUserInstance(userRepository);
    token = await givenAccesToken(reporter);
  });

  beforeEach(async () => {
    await reportRepository.deleteAll();
    await userReportRepository.deleteAll();
  });

  after(async () => {
    await deleteAllRepository(app);
  });

  it('gets all reporters from a report', async () => {
    const report = await givenReportInstance(reportRepository);
    const userReport = await givenUserReportInstance(userReportRepository, {
      reportId: report.id,
      reportedBy: reporter.id.toString(),
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

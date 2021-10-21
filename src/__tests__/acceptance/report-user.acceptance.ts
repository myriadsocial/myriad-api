import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../..';
import {
  ReportRepository,
  UserReportRepository,
  UserRepository,
} from '../../repositories';
import {
  givenReportInstance,
  givenReportRepository,
  givenUserInstance,
  givenUserReportInstance,
  givenUserReportRepository,
  givenUserRepository,
  setupApplication,
} from '../helpers';

describe('ReportUserApplication', () => {
  let app: MyriadApiApplication;
  let client: Client;
  let reportRepository: ReportRepository;
  let userRepository: UserRepository;
  let userReportRepository: UserReportRepository;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    reportRepository = await givenReportRepository(app);
    userReportRepository = await givenUserReportRepository(app);
    userRepository = await givenUserRepository(app);
  });

  beforeEach(async () => {
    await reportRepository.deleteAll();
    await userReportRepository.deleteAll();
    await userRepository.deleteAll();
  });

  it('gets all reporters from a report', async () => {
    const report = await givenReportInstance(reportRepository);
    const reporter = await givenUserInstance(userRepository);
    const userReport = await givenUserReportInstance(userReportRepository, {
      reportId: report.id,
      reportedBy: reporter.id,
    });
    const response = await client
      .get(`/reports/${report.id}/users`)
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

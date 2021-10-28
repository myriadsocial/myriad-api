import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../..';
import {ReferenceType} from '../../enums';
import {
  ReportRepository,
  UserReportRepository,
  UserRepository,
} from '../../repositories';
import {
  givenReportDetail,
  givenReportRepository,
  givenUserInstance,
  givenUserReportRepository,
  givenUserRepository,
  setupApplication,
} from '../helpers';

describe('UserReportApplication', () => {
  let app: MyriadApiApplication;
  let client: Client;
  let reportRepository: ReportRepository;
  let userReportRepository: UserReportRepository;
  let userRepository: UserRepository;

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

  it('creates a report', async () => {
    const reportDetail = givenReportDetail();
    const user = await givenUserInstance(userRepository);
    const response = await client
      .post(`/users/${user.id}/reports`)
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
  });

  it('rejects reporting a post when type is empty', async () => {
    const reportDetail = givenReportDetail({referenceType: ReferenceType.POST});
    const user = await givenUserInstance(userRepository);
    await client
      .post(`/users/${user.id}/reports`)
      .send(reportDetail)
      .expect(422);
  });
});

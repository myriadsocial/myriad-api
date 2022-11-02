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
  givenReportDetail,
  givenReportRepository,
  givenUserInstance,
  givenUserReportRepository,
  givenUserRepository,
  setupApplication,
} from '../helpers';
import {User} from '../../models';

describe('UserReportApplication', () => {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let reportRepository: ReportRepository;
  let userReportRepository: UserReportRepository;
  let userRepository: UserRepository;
  let user: User;

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
    user = await givenUserInstance(userRepository);
    token = await givenAccesToken(user);
  });

  beforeEach(async () => {
    await reportRepository.deleteAll();
    await userReportRepository.deleteAll();
  });

  after(async () => {
    await deleteAllRepository(app);
  });

  it('creates a report', async () => {
    const reportedUser = await givenUserInstance(userRepository, {
      username: 'hello',
    });
    const reportDetail = givenReportDetail({referenceId: reportedUser.id});
    const response = await client
      .post(`/user/reports`)
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

    await client
      .post(`/user/reports`)
      .set('Authorization', `Bearer ${token}`)
      .send(reportDetail)
      .expect(422);
  });
});

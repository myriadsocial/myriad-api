import {expect} from '@loopback/testlab';
import {UserReportController} from '../../../controllers';
import {
  ReportRepository,
  UserReportRepository,
  UserRepository,
} from '../../../repositories';
import {NotificationService} from '../../../services';
import {
  givenEmptyDatabase,
  givenReportDetail,
  givenRepositories,
  givenUserInstance,
  testdb,
} from '../../helpers';

describe('UserReportControllerIntegration', () => {
  let reportRepository: ReportRepository;
  let userRepository: UserRepository;
  let userReportRepository: UserReportRepository;
  let notificationService: NotificationService;
  let controller: UserReportController;

  before(async () => {
    ({reportRepository, userReportRepository, userRepository} =
      await givenRepositories(testdb));
  });

  before(async () => {
    controller = new UserReportController(
      reportRepository,
      userReportRepository,
      notificationService,
    );
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('creates reporters when creating a report', async () => {
    const reportDetail = givenReportDetail();
    const user = await givenUserInstance(userRepository);
    const response = await controller.create(user.id, reportDetail);
    const [result] = await userReportRepository.find();

    expect(result).to.containEql({
      reportedBy: user.id,
      reportId: response.id,
      description: reportDetail.description,
    });
  });
});

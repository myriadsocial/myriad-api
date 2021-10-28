import {expect} from '@loopback/testlab';
import {UserReportController} from '../../../controllers';
import {
  CommentRepository,
  PostRepository,
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
  let postRepository: PostRepository;
  let commentRepository: CommentRepository;
  let notificationService: NotificationService;
  let controller: UserReportController;

  before(async () => {
    ({
      reportRepository,
      userReportRepository,
      userRepository,
      postRepository,
      commentRepository,
    } = await givenRepositories(testdb));
  });

  before(async () => {
    controller = new UserReportController(
      reportRepository,
      userReportRepository,
      postRepository,
      commentRepository,
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

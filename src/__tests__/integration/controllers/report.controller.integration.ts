import {expect} from '@loopback/testlab';
import {ReportController} from '../../../controllers';
import {ReferenceType} from '../../../enums';
import {
  PostRepository,
  UserRepository,
  ReportRepository,
  NotificationRepository,
  UserSocialMediaRepository,
  FriendRepository,
} from '../../../repositories';
import {FCMService, NotificationService} from '../../../services';
import {
  givenEmptyDatabase,
  givenPostInstance,
  givenRepositories,
  givenUserInstance,
  testdb,
  givenReportInstance,
} from '../../helpers';

describe('ReportIntegration', () => {
  let reportRepository: ReportRepository;
  let userRepository: UserRepository;
  let postRepository: PostRepository;
  let controller: ReportController;
  let notificationRepository: NotificationRepository;
  let userSocialMediaRepository: UserSocialMediaRepository;
  let friendRepository: FriendRepository;
  let fcmService: FCMService;
  let notificationService: NotificationService;

  before(async () => {
    ({reportRepository, userRepository, postRepository} =
      await givenRepositories(testdb));
  });

  before(async () => {
    notificationService = new NotificationService(
      userRepository,
      postRepository,
      notificationRepository,
      userSocialMediaRepository,
      friendRepository,
      reportRepository,
      fcmService,
    );
    controller = new ReportController(reportRepository, notificationService);
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes User in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const reporter = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618gh',
    });
    const report = await givenReportInstance(reportRepository, {
      referenceType: ReferenceType.USER,
      referenceId: user.id,
      userId: user.id,
      reportedBy: reporter.id,
    });
    const response = await controller.find({});

    expect(response).to.containDeep([
      {
        ...report,
        user: user,
        reporter: reporter,
      },
    ]);
  });

  it('includes Post in find method result', async () => {
    const post = await givenPostInstance(postRepository);
    const report = await givenReportInstance(reportRepository, {
      referenceType: ReferenceType.POST,
      referenceId: post.id,
      postId: post.id,
      reportedBy:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618gh',
    });

    const response = await controller.find({});

    expect(response).to.containDeep([
      {
        ...report,
        post: post,
      },
    ]);
  });

  it('includes User in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const reporter = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618gh',
    });
    const report = await givenReportInstance(reportRepository, {
      referenceType: ReferenceType.USER,
      referenceId: user.id,
      userId: user.id,
      reportedBy: reporter.id,
    });
    const response = await controller.findById(report.id ?? '');

    expect(response).to.containDeep({
      ...report,
      user: user,
    });
  });

  it('includes Post in findById method result', async () => {
    const post = await givenPostInstance(postRepository);
    const report = await givenReportInstance(reportRepository, {
      referenceType: ReferenceType.POST,
      referenceId: post.id,
      postId: post.id,
      reportedBy:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618gh',
    });

    const response = await controller.findById(report.id ?? '');

    expect(response).to.containDeep({
      ...report,
      post: post,
    });
  });
});

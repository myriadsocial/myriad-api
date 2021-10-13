import {expect} from '@loopback/testlab';
import {DeletedCollectionController} from '../../../controllers';
import {NotificationType, ReferenceType} from '../../../enums';
import {Notification} from '../../../models';
import {
  CommentRepository,
  FriendRepository,
  NotificationRepository,
  PostRepository,
  ReportRepository,
  UserRepository,
  UserSocialMediaRepository,
} from '../../../repositories';
import {FCMService, NotificationService} from '../../../services';
import {
  givenEmptyDatabase,
  givenPostInstance,
  givenReportInstance,
  givenRepositories,
  givenUserInstance,
  testdb,
} from '../../helpers';

describe('DeleteCollectionControllerIntegration', () => {
  let userRepository: UserRepository;
  let commentRepository: CommentRepository;
  let postRepository: PostRepository;
  let reportRepository: ReportRepository;
  let notificationRepository: NotificationRepository;
  let userSocialMediaRepository: UserSocialMediaRepository;
  let friendRepository: FriendRepository;
  let notificationService: NotificationService;
  let fcmService: FCMService;
  let controller: DeletedCollectionController;

  before(async () => {
    ({
      userRepository,
      postRepository,
      notificationRepository,
      userSocialMediaRepository,
      friendRepository,
      reportRepository,
    } = await givenRepositories(testdb));
  });

  before(async () => {
    notificationService = new NotificationService(
      userRepository,
      postRepository,
      notificationRepository,
      userSocialMediaRepository,
      friendRepository,
      reportRepository,
      commentRepository,
      fcmService,
    );

    controller = new DeletedCollectionController(
      userRepository,
      postRepository,
      reportRepository,
      notificationService,
    );
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('adds notification when deleting a user', async () => {
    const user = await givenUserInstance(userRepository);
    const reporter = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61811',
    });
    const report = await givenReportInstance(reportRepository, {
      referenceType: ReferenceType.USER,
      referenceId: user.id,
      reportedBy: reporter.id,
    });

    await controller.deleteUserById(user.id);

    const [result] = await notificationRepository.find();

    delete result.id;
    delete result.createdAt;
    delete result.updatedAt;
    delete result.deletedAt;

    expect(result).to.deepEqual(
      new Notification({
        type: NotificationType.REPORT_USER,
        message: 'your account has been suspended',
        from: report.reportedBy,
        to: user.id,
        referenceId: user.id,
        read: false,
      }),
    );
  });

  it('adds notification when deleting a post', async () => {
    const creator = await givenUserInstance(userRepository);
    const reporter = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61811',
    });
    const post = await givenPostInstance(postRepository, {
      createdBy: creator.id,
    });
    const report = await givenReportInstance(reportRepository, {
      referenceType: ReferenceType.POST,
      referenceId: post.id,
      reportedBy: reporter.id,
    });

    await controller.deletePostById(post.id);

    const [result] = await notificationRepository.find();

    delete result.id;
    delete result.createdAt;
    delete result.updatedAt;
    delete result.deletedAt;

    expect(result).to.deepEqual(
      new Notification({
        type: NotificationType.REPORT_POST,
        message: 'your post has been deleted',
        from: report.reportedBy,
        to: post.createdBy,
        referenceId: post.id,
        read: false,
      }),
    );
  });
});

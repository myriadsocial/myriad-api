import {expect} from '@loopback/testlab';
import {ReportController} from '../../../controllers';
import {ReferenceType} from '../../../enums';
import {
  PostRepository,
  UserRepository,
  ReportRepository,
  UserReportRepository,
  CommentRepository,
} from '../../../repositories';
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
  let commentRepository: CommentRepository;
  let userReportRepository: UserReportRepository;
  let controller: ReportController;

  before(async () => {
    ({reportRepository, userRepository, postRepository, commentRepository} =
      await givenRepositories(testdb));
  });

  before(async () => {
    controller = new ReportController(
      reportRepository,
      userReportRepository,
      userRepository,
      postRepository,
      commentRepository,
    );
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes User in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const report = await givenReportInstance(reportRepository, {
      referenceType: ReferenceType.USER,
      referenceId: user.id,
      userId: user.id,
    });
    const response = await controller.find({});

    expect(response).to.containDeep([
      {
        ...report,
        reportedUser: user,
      },
    ]);
  });

  it('includes Post in find method result', async () => {
    const post = await givenPostInstance(postRepository);
    const report = await givenReportInstance(reportRepository, {
      referenceType: ReferenceType.POST,
      referenceId: post.id,
      postId: post.id,
    });

    const response = await controller.find({});

    expect(response).to.containDeep([
      {
        ...report,
        reportedPost: post,
      },
    ]);
  });

  it('includes User in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const report = await givenReportInstance(reportRepository, {
      referenceType: ReferenceType.USER,
      referenceId: user.id,
      userId: user.id,
    });
    const response = await controller.findById(report.id ?? '');

    expect(response).to.containDeep({
      ...report,
      reportedUser: user,
    });
  });

  it('includes Post in findById method result', async () => {
    const post = await givenPostInstance(postRepository);
    const report = await givenReportInstance(reportRepository, {
      referenceType: ReferenceType.POST,
      referenceId: post.id,
      postId: post.id,
    });

    const response = await controller.findById(report.id ?? '');

    expect(response).to.containDeep({
      ...report,
      reportedPost: post,
    });
  });
});

import {expect, toJSON} from '@loopback/testlab';
import {CommentCommentController} from '../../../controllers';
import {ReferenceType, NotificationType, PlatformType} from '../../../enums';
import {
  CommentLinkRepository,
  CommentRepository,
  NotificationRepository,
  PeopleRepository,
  PostRepository,
  TransactionRepository,
  UserRepository,
  UserSocialMediaRepository,
} from '../../../repositories';
import {FCMService, NotificationService} from '../../../services';
import {
  givenComment,
  givenCommentInstance,
  givenEmptyDatabase,
  givenMyriadPostInstance,
  givenPeopleInstance,
  givenPostInstance,
  givenRepositories,
  givenTransactionInstance,
  givenUserInstance,
  givenUserSocialMediaInstance,
  testdb,
} from '../../helpers';

describe('CommentCommentControllerIntegration', () => {
  let commentRepository: CommentRepository;
  let userRepository: UserRepository;
  let postRepository: PostRepository;
  let peopleRepository: PeopleRepository;
  let commentLinkRepository: CommentLinkRepository;
  let transactionRepository: TransactionRepository;
  let controller: CommentCommentController;
  let notificationRepository: NotificationRepository;
  let userSocialMediaRepository: UserSocialMediaRepository;
  let notificationService: NotificationService;
  let fcmService: FCMService;

  before(async () => {
    ({
      userRepository,
      commentRepository,
      postRepository,
      notificationRepository,
      transactionRepository,
      userSocialMediaRepository,
      commentLinkRepository,
      peopleRepository,
    } = await givenRepositories(testdb));
  });

  before(async () => {
    notificationService = new NotificationService(
      userRepository,
      postRepository,
      notificationRepository,
      userSocialMediaRepository,
      fcmService,
    );
    controller = new CommentCommentController(
      commentRepository,
      notificationService,
    );
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes Transactions in find method result', async () => {
    const post = await givenPostInstance(postRepository);
    const fromComment = await givenCommentInstance(commentRepository, {
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      postId: post.id,
      referenceId: post.id,
      type: ReferenceType.POST,
    });
    const toComment = await givenCommentInstance(commentRepository, {
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      postId: post.id,
      referenceId: fromComment.id,
      type: ReferenceType.COMMENT,
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: toComment.id,
      type: ReferenceType.COMMENT,
    });

    await commentLinkRepository.create({
      fromCommentId: fromComment.id,
      toCommentId: toComment.id,
    });

    const response = await controller.find(fromComment.id ?? '', {
      include: ['transactions'],
    });

    expect(response).to.containDeep([
      {
        ...toComment,
        transactions: [transaction],
      },
    ]);
  });

  it('includes User in find method result', async () => {
    const post = await givenPostInstance(postRepository);
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const fromComment = await givenCommentInstance(commentRepository, {
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      postId: post.id,
      referenceId: post.id,
      type: ReferenceType.POST,
    });
    const toComment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: post.id,
      referenceId: fromComment.id,
      type: ReferenceType.COMMENT,
    });

    await commentLinkRepository.create({
      fromCommentId: fromComment.id,
      toCommentId: toComment.id,
    });

    const response = await controller.find(fromComment.id ?? '', {
      include: ['user'],
    });

    expect(response).to.containDeep([
      {
        ...toComment,
        user: user,
      },
    ]);
  });

  it('includes both Transaction and User in find method result', async () => {
    const post = await givenPostInstance(postRepository);
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const fromComment = await givenCommentInstance(commentRepository, {
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      postId: post.id,
      referenceId: post.id,
      type: ReferenceType.POST,
    });
    const toComment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: post.id,
      referenceId: fromComment.id,
      type: ReferenceType.COMMENT,
    });

    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: toComment.id,
      type: ReferenceType.COMMENT,
    });

    await commentLinkRepository.create({
      fromCommentId: fromComment.id,
      toCommentId: toComment.id,
    });

    const response = await controller.find(fromComment.id ?? '', {
      include: ['user', 'transactions'],
    });

    expect(response).to.containDeep([
      {
        ...toComment,
        user: user,
        transactions: [transaction],
      },
    ]);
  });

  it('creates a notification when a user comment on a myriad post', async () => {
    const otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccckcfb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const post = await givenMyriadPostInstance(postRepository, {
      createdBy: otherUser.id,
      platform: PlatformType.MYRIAD,
    });
    const user = await givenUserInstance(userRepository);
    const comment = await givenCommentInstance(commentRepository, {
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      postId: post.id,
      referenceId: post.id,
      type: ReferenceType.POST,
    });
    const commentInstance = givenComment({
      postId: post.id,
      userId: user.id,
      text: 'hello world',
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });

    const newComment = await controller.create(comment.id, commentInstance);

    const notifications = await notificationRepository.find({
      where: {
        from: newComment.userId,
        to: post.createdBy,
        referenceId: newComment.id,
      },
    });

    delete notifications[0].id;
    delete notifications[0].createdAt;
    delete notifications[0].updatedAt;

    expect({
      type: NotificationType.POST_COMMENT,
      from: newComment.userId,
      read: false,
      to: post.createdBy,
      referenceId: newComment.id,
      message: 'commented: ' + newComment.text,
    }).to.containDeep(toJSON(notifications[0]));
  });

  it('creates a notification when a user comment on a post from other social media and the post belong to user', async () => {
    const otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccckcfb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const people = await givenPeopleInstance(peopleRepository);
    await givenUserSocialMediaInstance(userSocialMediaRepository, {
      userId: otherUser.id,
      peopleId: people.id,
    });
    const post = await givenPostInstance(postRepository, {
      createdBy: otherUser.id,
      peopleId: people.id,
    });
    const user = await givenUserInstance(userRepository);
    const comment = await givenCommentInstance(commentRepository, {
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      postId: post.id,
      referenceId: post.id,
      type: ReferenceType.POST,
    });
    const commentInstance = givenComment({
      postId: post.id,
      userId: user.id,
      text: 'hello world',
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });

    const newComment = await controller.create(comment.id, commentInstance);

    const notifications = await notificationRepository.find({
      where: {
        from: newComment.userId,
        to: otherUser.id,
        referenceId: newComment.id,
      },
    });

    delete notifications[0].id;
    delete notifications[0].createdAt;
    delete notifications[0].updatedAt;

    expect({
      type: NotificationType.POST_COMMENT,
      from: newComment.userId,
      read: false,
      to: otherUser.id,
      referenceId: newComment.id,
      message: 'commented: ' + newComment.text,
    }).to.containDeep(toJSON(notifications[0]));
  });
});

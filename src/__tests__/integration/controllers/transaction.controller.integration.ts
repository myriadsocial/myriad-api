import {expect, toJSON} from '@loopback/testlab';
import {TransactionController} from '../../../controllers';
import {NotificationType, ReferenceType} from '../../../enums';
import {
  CommentRepository,
  FriendRepository,
  NotificationRepository,
  NotificationSettingRepository,
  PostRepository,
  ReportRepository,
  TransactionRepository,
  UserRepository,
  UserSocialMediaRepository,
} from '../../../repositories';
import {FCMService, NotificationService} from '../../../services';
import {
  givenCommentInstance,
  givenEmptyDatabase,
  givenPostInstance,
  givenRepositories,
  givenTransaction,
  givenTransactionInstance,
  givenUserInstance,
  testdb,
} from '../../helpers';

describe('TransactionControllerIntegration', () => {
  let transactionRepository: TransactionRepository;
  let userRepository: UserRepository;
  let postRepository: PostRepository;
  let notificationRepository: NotificationRepository;
  let userSocialMediaRepository: UserSocialMediaRepository;
  let friendRepository: FriendRepository;
  let reportRepository: ReportRepository;
  let commentRepository: CommentRepository;
  let notificationSettingRepository: NotificationSettingRepository;
  let fcmService: FCMService;
  let notificationService: NotificationService;
  let controller: TransactionController;

  before(async () => {
    ({
      transactionRepository,
      userRepository,
      postRepository,
      notificationRepository,
      userSocialMediaRepository,
      friendRepository,
      commentRepository,
      notificationSettingRepository,
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
      notificationSettingRepository,
      fcmService,
    );
    controller = new TransactionController(
      transactionRepository,
      notificationService,
    );
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes fromUser in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });

    const transaction = await givenTransactionInstance(transactionRepository, {
      from: user.id,
      to: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });

    const response = await controller.find({include: ['fromUser']});

    expect(response).to.containDeep([
      {
        ...transaction,
        fromUser: user,
      },
    ]);
  });

  it('includes toUser in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      to: user.id,
      from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });
    const response = await controller.find({include: ['toUser']});

    expect(response).to.containDeep([
      {
        ...transaction,
        toUser: user,
      },
    ]);
  });

  it('includes both fromUser and toUser in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      from: user.id,
      to: otherUser.id,
    });
    const response = await controller.find({include: ['fromUser', 'toUser']});

    expect(response).to.containDeep([
      {
        ...transaction,
        fromUser: user,
        toUser: otherUser,
      },
    ]);
  });

  it('includes fromUser in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });

    const transaction = await givenTransactionInstance(transactionRepository, {
      from: user.id,
      to: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });

    const response = await controller.findById(transaction.id ?? '', {
      include: ['fromUser'],
    });

    expect(response).to.containDeep({
      ...transaction,
      fromUser: user,
    });
  });

  it('includes toUser in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      to: user.id,
      from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });

    const response = await controller.findById(transaction.id ?? '', {
      include: ['toUser'],
    });

    expect(response).to.containDeep({
      ...transaction,
      toUser: user,
    });
  });

  it('includes both fromUser and toUser in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      from: user.id,
      to: otherUser.id,
    });

    const response = await controller.findById(transaction.id ?? '', {
      include: ['fromUser', 'toUser'],
    });

    expect(response).to.containDeep({
      ...transaction,
      fromUser: user,
      toUser: otherUser,
    });
  });

  it('creates a notification when user send tips to another user from post', async () => {
    const user = await givenUserInstance(userRepository);
    const anotherUser = await givenUserInstance(userRepository, {
      id: '0x06ccffd22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61859',
    });
    const post = await givenPostInstance(postRepository);
    const transaction = givenTransaction({
      from: user.id,
      to: anotherUser.id,
      referenceId: post.id,
      type: ReferenceType.POST,
    });
    const response = await controller.create(transaction);
    const notification = await notificationRepository.findOne({
      where: {
        from: response.from,
      },
    });

    delete notification?.id;
    delete notification?.createdAt;
    delete notification?.updatedAt;
    delete notification?.deletedAt;

    expect(toJSON(notification)).to.deepEqual({
      type: NotificationType.POST_TIPS,
      from: response.from,
      referenceId: response.id,
      message: response.amount + ' ' + response.currencyId,
      additionalReferenceId: [{postId: post.id}],
      to: response.to,
      read: false,
    });
  });

  it('creates a notification when user send tips to another user from comment', async () => {
    const user = await givenUserInstance(userRepository);
    const anotherUser = await givenUserInstance(userRepository, {
      id: '0x06ccffd22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61859',
    });
    const post = await givenPostInstance(postRepository);
    const comment = await givenCommentInstance(commentRepository, {
      referenceId: post.id,
      postId: post.id,
      type: ReferenceType.POST,
      userId: anotherUser.id,
    });
    const transaction = givenTransaction({
      from: user.id,
      to: anotherUser.id,
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });
    const response = await controller.create(transaction);
    const notification = await notificationRepository.findOne({
      where: {
        from: response.from,
      },
    });

    delete notification?.id;
    delete notification?.createdAt;
    delete notification?.updatedAt;
    delete notification?.deletedAt;

    expect(toJSON(notification)).to.deepEqual({
      type: NotificationType.COMMENT_TIPS,
      from: response.from,
      referenceId: response.id,
      message: response.amount + ' ' + response.currencyId,
      additionalReferenceId: [{postId: post.id}],
      to: response.to,
      read: false,
    });
  });
});

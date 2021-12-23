import {expect, toJSON} from '@loopback/testlab';
import {TransactionController} from '../../../controllers';
import {NotificationType, ReferenceType} from '../../../enums';
import {
  CommentRepository,
  NotificationRepository,
  PostRepository,
  TransactionRepository,
  UserRepository,
} from '../../../repositories';
import {NotificationService} from '../../../services';
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
  let commentRepository: CommentRepository;
  let notificationService: NotificationService;
  let controller: TransactionController;

  before(async () => {
    ({
      transactionRepository,
      userRepository,
      postRepository,
      notificationRepository,
      notificationService,
      commentRepository,
    } = await givenRepositories(testdb));
  });

  before(async () => {
    controller = new TransactionController(
      transactionRepository,
      notificationService,
    );
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes fromUser in find method result', async () => {
    const user = await givenUserInstance(userRepository);

    const transaction = await givenTransactionInstance(transactionRepository, {
      from: user.id,
      to: '2',
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
    const user = await givenUserInstance(userRepository);
    const transaction = await givenTransactionInstance(transactionRepository, {
      to: user.id,
      from: '2',
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
    const user = await givenUserInstance(userRepository);
    const otherUser = await givenUserInstance(userRepository, {
      name: 'Kirania',
      username: 'kirania',
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
    const user = await givenUserInstance(userRepository);

    const transaction = await givenTransactionInstance(transactionRepository, {
      from: user.id,
      to: '2',
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
    const user = await givenUserInstance(userRepository);
    const transaction = await givenTransactionInstance(transactionRepository, {
      to: user.id,
      from: '2',
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
    const user = await givenUserInstance(userRepository);
    const otherUser = await givenUserInstance(userRepository, {
      name: 'Kirania',
      username: 'kirania',
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
      name: 'Kirania',
      username: 'kirania',
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
      name: 'Kirania',
      username: 'kirania',
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

import {expect, toJSON} from '@loopback/testlab';
import {TransactionController} from '../../../controllers';
import {NotificationType, ReferenceType} from '../../../enums';
import {
  CommentRepository,
  NotificationRepository,
  PostRepository,
  TransactionRepository,
  UserRepository,
  WalletRepository,
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
  givenWalletInstance,
  testdb,
} from '../../helpers';

describe('TransactionControllerIntegration', () => {
  let transactionRepository: TransactionRepository;
  let userRepository: UserRepository;
  let postRepository: PostRepository;
  let notificationRepository: NotificationRepository;
  let commentRepository: CommentRepository;
  let walletRepository: WalletRepository;
  let notificationService: NotificationService;
  let controller: TransactionController;

  before(async () => {
    ({
      transactionRepository,
      userRepository,
      postRepository,
      notificationRepository,
      walletRepository,
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

  it('includes fromWallet in find method result', async () => {
    const wallet = await givenWalletInstance(walletRepository);
    const transaction = await givenTransactionInstance(transactionRepository, {
      from: wallet.id,
      to: '2',
    });
    const response = await controller.find({include: ['fromWallet']});

    expect(response).to.containDeep([
      {
        ...transaction,
        fromWallet: wallet,
      },
    ]);
  });

  it('includes toWallet in find method result', async () => {
    const wallet = await givenWalletInstance(walletRepository);
    const transaction = await givenTransactionInstance(transactionRepository, {
      to: wallet.id,
      from: '2',
    });
    const response = await controller.find({include: ['toWallet']});

    expect(response).to.containDeep([
      {
        ...transaction,
        toWallet: wallet,
      },
    ]);
  });

  it('includes both fromWallet and toWallet in find method result', async () => {
    const wallet = await givenWalletInstance(walletRepository);
    const otherWallet = await givenWalletInstance(walletRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61888',
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      from: wallet.id,
      to: otherWallet.id,
    });
    const response = await controller.find({
      include: ['fromWallet', 'toWallet'],
    });

    expect(response).to.containDeep([
      {
        ...transaction,
        fromWallet: wallet,
        toWallet: otherWallet,
      },
    ]);
  });

  it('includes fromWallet in findById method result', async () => {
    const wallet = await givenWalletInstance(walletRepository);

    const transaction = await givenTransactionInstance(transactionRepository, {
      from: wallet.id,
      to: '2',
    });

    const response = await controller.findById(transaction.id ?? '', {
      include: ['fromWallet'],
    });

    expect(response).to.containDeep({
      ...transaction,
      fromWallet: wallet,
    });
  });

  it('includes toWallet in findById method result', async () => {
    const wallet = await givenWalletInstance(walletRepository);

    const transaction = await givenTransactionInstance(transactionRepository, {
      to: wallet.id,
      from: '2',
    });

    const response = await controller.findById(transaction.id ?? '', {
      include: ['toWallet'],
    });

    expect(response).to.containDeep({
      ...transaction,
      toWallet: wallet,
    });
  });

  it('includes both fromWallet and toWallet in findById method result', async () => {
    const wallet = await givenWalletInstance(walletRepository);
    const otherWallet = await givenWalletInstance(walletRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61888',
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      from: wallet.id,
      to: otherWallet.id,
    });

    const response = await controller.findById(transaction.id ?? '', {
      include: ['fromWallet', 'toWallet'],
    });

    expect(response).to.containDeep({
      ...transaction,
      fromWallet: wallet,
      toWallet: otherWallet,
    });
  });

  it('creates a notification when user send tips to another user from post', async () => {
    const user = await givenUserInstance(userRepository);
    const wallet = await givenWalletInstance(walletRepository, {
      userId: user.id,
    });
    const anotherUser = await givenUserInstance(userRepository, {
      name: 'Kirania',
      username: 'kirania',
    });
    const otherWallet = await givenWalletInstance(walletRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61888',
      userId: anotherUser.id,
    });
    const post = await givenPostInstance(postRepository, {
      createdBy: anotherUser.id,
    });
    const transaction = givenTransaction({
      from: wallet.id,
      to: otherWallet.id,
      referenceId: post.id,
      type: ReferenceType.POST,
    });
    const response = await controller.create(transaction);
    const notification = await notificationRepository.findOne({
      where: {
        from: user.id,
      },
    });

    delete notification?.id;
    delete notification?.createdAt;
    delete notification?.updatedAt;
    delete notification?.deletedAt;

    expect(toJSON(notification)).to.deepEqual({
      type: NotificationType.POST_TIPS,
      from: user.id,
      referenceId: response.id,
      message: response.amount + ' ' + response.currencyId,
      additionalReferenceId: [{postId: post.id}],
      to: anotherUser.id,
      read: false,
    });
  });

  it('creates a notification when user send tips to another user from comment', async () => {
    const user = await givenUserInstance(userRepository);
    const wallet = await givenWalletInstance(walletRepository, {
      userId: user.id,
    });
    const anotherUser = await givenUserInstance(userRepository, {
      name: 'Kirania',
      username: 'kirania',
    });
    const otherWallet = await givenWalletInstance(walletRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61888',
      userId: anotherUser.id,
    });
    const post = await givenPostInstance(postRepository, {
      createdBy: anotherUser.id,
    });
    const comment = await givenCommentInstance(commentRepository, {
      referenceId: post.id,
      postId: post.id,
      type: ReferenceType.POST,
      userId: anotherUser.id,
    });
    const transaction = givenTransaction({
      from: wallet.id,
      to: otherWallet.id,
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });
    const response = await controller.create(transaction);
    const notification = await notificationRepository.findOne({
      where: {
        from: user.id,
      },
    });

    delete notification?.id;
    delete notification?.createdAt;
    delete notification?.updatedAt;
    delete notification?.deletedAt;

    expect(toJSON(notification)).to.deepEqual({
      type: NotificationType.COMMENT_TIPS,
      from: user.id,
      referenceId: response.id,
      message: response.amount + ' ' + response.currencyId,
      additionalReferenceId: [{postId: post.id}],
      to: anotherUser.id,
      read: false,
    });
  });
});

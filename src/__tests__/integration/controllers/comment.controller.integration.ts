import {expect, toJSON} from '@loopback/testlab';
import {CommentController} from '../../../controllers';
import {NotificationType, PlatformType, TransactionType} from '../../../enums';
import {
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

describe('CommentControllerIntegration', () => {
  let commentRepository: CommentRepository;
  let userRepository: UserRepository;
  let postRepository: PostRepository;
  let transactionRepository: TransactionRepository;
  let controller: CommentController;
  let notificationRepository: NotificationRepository;
  let userSocialMediaRepository: UserSocialMediaRepository;
  let peopleRepository: PeopleRepository;
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
    controller = new CommentController(commentRepository, notificationService);
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes Transactions in find method result', async () => {
    const comment = await givenCommentInstance(commentRepository, {
      userId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      postId: '1',
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: comment.id,
      type: TransactionType.COMMENT,
    });

    const response = await controller.find({include: ['transactions']});

    expect(response).to.containDeep([
      {
        ...comment,
        transactions: [transaction],
      },
    ]);
  });

  it('includes Post in find method result', async () => {
    const post = await givenPostInstance(postRepository);
    const comment = await givenCommentInstance(commentRepository, {
      userId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      postId: post.id,
    });
    const response = await controller.find({include: ['post']});

    expect(response).to.containDeep([
      {
        ...comment,
        post: post,
      },
    ]);
  });

  it('includes User in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: '1',
    });

    const response = await controller.find({include: ['user']});

    expect(response).to.containDeep([
      {
        ...comment,
        user: user,
      },
    ]);
  });

  it('includes Transaction, Post, and User in find method result', async () => {
    const post = await givenPostInstance(postRepository);
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: post.id,
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: comment.id,
      type: TransactionType.COMMENT,
    });

    const response = await controller.find({include: ['user', 'transactions', 'post']});

    expect(response).to.containDeep([
      {
        ...comment,
        user: user,
        post: post,
        transactions: [transaction],
      },
    ]);
  });

  it('includes Transactions in findById method result', async () => {
    const comment = await givenCommentInstance(commentRepository, {
      userId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      postId: '1',
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: comment.id,
      type: TransactionType.COMMENT,
    });

    const response = await controller.findById(comment.id ?? '', {include: ['transactions']});

    expect(response).to.containDeep({
      ...comment,
      transactions: [transaction],
    });
  });

  it('includes Post in findById method result', async () => {
    const post = await givenPostInstance(postRepository);
    const comment = await givenCommentInstance(commentRepository, {
      userId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      postId: post.id,
    });

    const response = await controller.findById(comment.id ?? '', {include: ['post']});

    expect(response).to.containDeep({
      ...comment,
      post: post,
    });
  });

  it('includes User in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: '1',
    });

    const response = await controller.findById(comment.id ?? '', {include: ['user']});

    expect(response).to.containDeep({
      ...comment,
      user: user,
    });
  });

  it('includes Transaction, Post, and User in findById method result', async () => {
    const post = await givenPostInstance(postRepository);
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: post.id,
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: comment.id,
      type: TransactionType.COMMENT,
    });

    const response = await controller.findById(comment.id ?? '', {
      include: ['user', 'transactions', 'post'],
    });

    expect(response).to.containDeep({
      ...comment,
      user: user,
      post: post,
      transactions: [transaction],
    });
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
    const commentInstance = givenComment({
      postId: post.id,
      userId: user.id,
      text: 'hello world',
    });

    const newComment = await controller.create(commentInstance);

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
    const commentInstance = givenComment({
      postId: post.id,
      userId: user.id,
      text: 'hello world',
    });

    const newComment = await controller.create(commentInstance);

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

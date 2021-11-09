import {expect, toJSON} from '@loopback/testlab';
import {CommentController} from '../../../controllers';
import {ReferenceType, NotificationType, PlatformType} from '../../../enums';
import {
  CommentRepository,
  FriendRepository,
  NotificationRepository,
  NotificationSettingRepository,
  PeopleRepository,
  PostRepository,
  ReportRepository,
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
  let friendRepository: FriendRepository;
  let notificationSettingRepository: NotificationSettingRepository;
  let reportRepository: ReportRepository;

  before(async () => {
    ({
      userRepository,
      commentRepository,
      postRepository,
      notificationRepository,
      transactionRepository,
      userSocialMediaRepository,
      peopleRepository,
      friendRepository,
      reportRepository,
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
    controller = new CommentController(
      commentRepository,
      postRepository,
      notificationService,
    );
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes Transactions in find method result', async () => {
    const comment = await givenCommentInstance(commentRepository, {
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      postId: '1',
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });

    const response = await controller.find({include: ['transactions']});

    expect(response).to.containDeep([
      {
        ...comment,
        transactions: [transaction],
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

  it('includes two levels Comments in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: '9999',
      referenceId: '9999',
    });
    const otherComment = givenComment({
      userId: user.id,
      postId: '9999',
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });
    const newOtherComment = await commentRepository
      .comments(comment.id)
      .create(otherComment);

    const anotherComment = givenComment({
      userId: user.id,
      postId: '9999',
      referenceId: newOtherComment.id,
      type: ReferenceType.COMMENT,
    });

    const newAnotherComment = await commentRepository
      .comments(newOtherComment.id)
      .create(anotherComment);

    const response = await controller.find({
      include: [
        {
          relation: 'comments',
          scope: {
            include: ['comments'],
          },
        },
      ],
    });

    expect(response).to.containDeep([
      {
        ...comment,
        comments: [
          {
            ...newOtherComment,
            comments: [newAnotherComment],
          },
        ],
      },
    ]);
  });

  it('includes Transaction, User, and two levels Comments in find method result', async () => {
    const post = await givenPostInstance(postRepository);
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: post.id,
      referenceId: post.id,
      type: ReferenceType.POST,
    });
    const otherComment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });
    const newOtherComment = await commentRepository
      .comments(comment.id)
      .create(otherComment);

    const anotherComment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: newOtherComment.id,
      type: ReferenceType.COMMENT,
    });

    const newAnotherComment = await commentRepository
      .comments(newOtherComment.id)
      .create(anotherComment);

    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });

    const response = await controller.find({
      include: [
        {
          relation: 'user',
        },
        {
          relation: 'transactions',
        },
        {
          relation: 'comments',
          scope: {
            include: ['comments'],
          },
        },
      ],
    });

    expect(response).to.containDeep([
      {
        ...comment,
        user: user,
        transactions: [transaction],
        comments: [
          {
            ...newOtherComment,
            comments: [newAnotherComment],
          },
        ],
      },
    ]);
  });

  it('includes Transactions in findById method result', async () => {
    const comment = await givenCommentInstance(commentRepository, {
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      postId: '1',
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });

    const response = await controller.findById(comment.id ?? '', {
      include: ['transactions'],
    });

    expect(response).to.containDeep({
      ...comment,
      transactions: [transaction],
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

    const response = await controller.findById(comment.id ?? '', {
      include: ['user'],
    });

    expect(response).to.containDeep({
      ...comment,
      user: user,
    });
  });

  it('includes two levels Comments in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: '9999',
      referenceId: '9999',
    });
    const otherComment = givenComment({
      userId: user.id,
      postId: '9999',
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });
    const newOtherComment = await commentRepository
      .comments(comment.id)
      .create(otherComment);

    const anotherComment = givenComment({
      userId: user.id,
      postId: '9999',
      referenceId: newOtherComment.id,
      type: ReferenceType.COMMENT,
    });

    const newAnotherComment = await commentRepository
      .comments(newOtherComment.id)
      .create(anotherComment);

    const response = await controller.findById(comment.id ?? '', {
      include: [
        {
          relation: 'comments',
          scope: {
            include: ['comments'],
          },
        },
      ],
    });

    expect(response).to.containDeep({
      ...comment,
      comments: [
        {
          ...newOtherComment,
          comments: [newAnotherComment],
        },
      ],
    });
  });

  it('includes Transaction, User, and two levels Comments in findById method result', async () => {
    const post = await givenPostInstance(postRepository);
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: post.id,
      referenceId: post.id,
      type: ReferenceType.POST,
    });
    const otherComment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });
    const newOtherComment = await commentRepository
      .comments(comment.id)
      .create(otherComment);

    const anotherComment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: newOtherComment.id,
      type: ReferenceType.COMMENT,
    });

    const newAnotherComment = await commentRepository
      .comments(newOtherComment.id)
      .create(anotherComment);

    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });

    const response = await controller.findById(comment.id ?? '', {
      include: [
        {
          relation: 'user',
        },
        {
          relation: 'transactions',
        },
        {
          relation: 'comments',
          scope: {
            include: ['comments'],
          },
        },
      ],
    });

    expect(response).to.containDeep({
      ...comment,
      user: user,
      transactions: [transaction],
      comments: [
        {
          ...newOtherComment,
          comments: [newAnotherComment],
        },
      ],
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
      referenceId: post.id,
      type: ReferenceType.POST,
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
      additionalReferenceId: [{postId: post.id}],
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
      referenceId: post.id,
      type: ReferenceType.POST,
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
      additionalReferenceId: [{postId: post.id}],
      message: 'commented: ' + newComment.text,
    }).to.containDeep(toJSON(notifications[0]));
  });

  it('creates a notification when a user comment on a comment', async () => {
    const otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccckcfb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const post = await givenMyriadPostInstance(postRepository, {
      createdBy: otherUser.id,
      platform: PlatformType.MYRIAD,
    });
    const user = await givenUserInstance(userRepository);
    const comment = await givenCommentInstance(commentRepository, {
      postId: post.id,
      userId: user.id,
      text: 'hello world',
      referenceId: post.id,
      type: ReferenceType.POST,
    });
    const commentInstance = givenComment({
      postId: post.id,
      userId: otherUser.id,
      text: 'welcome world',
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });

    const response = await controller.create(commentInstance);
    const notification = await notificationRepository.findOne({
      where: {
        from: response.userId,
      },
    });

    delete notification?.id;
    delete notification?.createdAt;
    delete notification?.updatedAt;
    delete notification?.deletedAt;

    expect(toJSON(notification)).to.deepEqual({
      type: NotificationType.COMMENT_COMMENT,
      from: response.userId,
      referenceId: response.id,
      message: 'commented: ' + response.text,
      additionalReferenceId: [{postId: post.id}, {firstCommentId: comment.id}],
      to: comment.userId,
      read: false,
    });
  });
});

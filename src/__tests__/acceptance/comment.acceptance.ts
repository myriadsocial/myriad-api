import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {ReferenceType, NotificationType} from '../../enums';
import {Comment, Notification, People, Post, User} from '../../models';
import {
  ActivityLogRepository,
  CommentRepository,
  NotificationRepository,
  NotificationSettingRepository,
  PeopleRepository,
  PostRepository,
  TransactionRepository,
  UserRepository,
  UserSocialMediaRepository,
} from '../../repositories';
import {
  givenAccesToken,
  givenActivityLogRepository,
  givenComment,
  givenCommentInstance,
  givenCommentRepository,
  givenMultipleCommentInstances,
  givenNotificationRepository,
  givenNotificationSettingInstance,
  givenNotificationSettingRepository,
  givenPeopleInstance,
  givenPeopleRepository,
  givenPostInstance,
  givenPostRepository,
  givenTransactionInstance,
  givenTransactionRepository,
  givenUserInstance,
  givenUserRepository,
  givenUserSocialMediaInstance,
  givenUserSocialMediaRepository,
  setupApplication,
} from '../helpers';

describe('CommentApplication', function () {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let userRepository: UserRepository;
  let commentRepository: CommentRepository;
  let postRepository: PostRepository;
  let transactionRepository: TransactionRepository;
  let notificationRepository: NotificationRepository;
  let notificationSettingRepository: NotificationSettingRepository;
  let peopleRepository: PeopleRepository;
  let userSocialMediaRepository: UserSocialMediaRepository;
  let activityLogRepository: ActivityLogRepository;
  let user: User;
  let post: Post;
  let people: People;
  let otherUser: User;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    userRepository = await givenUserRepository(app);
    commentRepository = await givenCommentRepository(app);
    postRepository = await givenPostRepository(app);
    transactionRepository = await givenTransactionRepository(app);
    notificationRepository = await givenNotificationRepository(app);
    peopleRepository = await givenPeopleRepository(app);
    userSocialMediaRepository = await givenUserSocialMediaRepository(app);
    activityLogRepository = await givenActivityLogRepository(app);
    notificationSettingRepository = await givenNotificationSettingRepository(
      app,
    );
  });

  beforeEach(async () => {
    await commentRepository.deleteAll();
    await userRepository.deleteAll();
    await postRepository.deleteAll();
    await transactionRepository.deleteAll();
    await notificationRepository.deleteAll();
    await peopleRepository.deleteAll();
    await userSocialMediaRepository.deleteAll();
    await notificationSettingRepository.deleteAll();
    await activityLogRepository.deleteAll();
  });

  beforeEach(async () => {
    user = await givenUserInstance(userRepository);
    token = await givenAccesToken(user);
    otherUser = await givenUserInstance(userRepository, {
      name: 'John Doe',
      username: 'johndoe',
    });
    people = await givenPeopleInstance(peopleRepository);
    post = await givenPostInstance(postRepository, {
      createdBy: otherUser.id,
      peopleId: people.id,
    });
    await givenUserSocialMediaInstance(userSocialMediaRepository, {
      userId: otherUser.id,
      peopleId: people.id,
    });
  });

  it('creates a comment', async () => {
    const comment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: post.id,
      type: ReferenceType.POST,
    });

    const response = await client
      .post('/comments')
      .set('Authorization', `Bearer ${token}`)
      .send(comment)
      .expect(200);
    expect(response.body).to.containDeep(comment);
    const result = await commentRepository.findById(response.body.id);
    expect(result).to.containDeep(comment);
  });

  it('creates a notification when creating a comment', async () => {
    const comment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: post.id,
      type: ReferenceType.POST,
    });

    const response = await client
      .post('/comments')
      .set('Authorization', `Bearer ${token}`)
      .send(comment)
      .expect(200);
    const notification = await notificationRepository.findOne({
      where: {referenceId: response.body.id},
    });
    const expected = new Notification({
      id: notification?.id,
      type: NotificationType.POST_COMMENT,
      from: user.id,
      to: otherUser.id,
      read: false,
      referenceId: response.body.id,
      message: 'commented: ' + comment.text,
      additionalReferenceId: [{postId: post.id}],
      createdAt: notification?.createdAt,
      updatedAt: notification?.updatedAt,
      deletedAt: undefined,
    });
    expect(expected).to.containDeep(notification);
  });

  it('does not create a notification when notification setting for comments is off', async () => {
    await givenNotificationSettingInstance(notificationSettingRepository, {
      userId: user.id,
      comments: false,
    });
    await givenNotificationSettingInstance(notificationSettingRepository, {
      userId: otherUser.id,
      comments: false,
    });

    const comment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: post.id,
      type: ReferenceType.POST,
    });

    const response = await client
      .post('/comments')
      .set('Authorization', `Bearer ${token}`)
      .send(comment)
      .expect(200);
    const notification = await notificationRepository.findOne({
      where: {referenceId: response.body.id},
    });
    const expected = null;
    expect(expected).to.containDeep(notification);
  });

  it('adds by 1 post metric comments', async () => {
    const comment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: post.id,
      type: ReferenceType.POST,
    });

    await client
      .post('/comments')
      .set('Authorization', `Bearer ${token}`)
      .send(comment)
      .expect(200);
    const resultPost = await postRepository.findById(post.id);
    post.metric.discussions = (
      await commentRepository.count({postId: post.id})
    ).count;
    post.metric.comments = post.metric.discussions;
    post.popularCount = 1;

    expect(resultPost).to.containDeep(post);
  });

  it('returns 401 when creates a comment not as login user', async () => {
    const comment = givenComment({
      postId: post.id,
      referenceId: post.id,
      type: ReferenceType.POST,
      userId: otherUser.id,
    });

    await client
      .post('/comments')
      .set('Authorization', `Bearer ${token}`)
      .send(comment)
      .expect(401);
  });

  it('returns 422 when created a comment with no referenceId and no type', async () => {
    const comment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: undefined,
      type: undefined,
    });

    await client
      .post('/comments')
      .set('Authorization', `Bearer ${token}`)
      .send(comment)
      .expect(422);
  });

  it('rejects requests to create a comment with no postId', async () => {
    const comment = givenComment({
      userId: user.id,
      referenceId: post.id,
      type: ReferenceType.POST,
    });

    await client
      .post('/comments')
      .set('Authorization', `Bearer ${token}`)
      .send(comment)
      .expect(422);
  });

  it('rejects request to create a comments more than three levels comment', async () => {
    // First level
    const comment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: post.id,
      type: ReferenceType.POST,
    });
    const response = await client
      .post('/comments')
      .set('Authorization', `Bearer ${token}`)
      .send(comment)
      .expect(200);
    const newComment = response.body;

    // Second level
    const otherComment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: newComment.id,
      type: ReferenceType.COMMENT,
    });
    const otherResponse = await client
      .post('/comments')
      .set('Authorization', `Bearer ${token}`)
      .send(otherComment)
      .expect(200);
    const otherNewComment = otherResponse.body;

    // Third level
    const anotherComment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: otherNewComment.id,
      type: ReferenceType.COMMENT,
    });
    const anotherResponse = await client
      .post('/comments')
      .set('Authorization', `Bearer ${token}`)
      .send(anotherComment)
      .expect(200);
    const anotherNewComment = anotherResponse.body;

    // Rejected comment
    const rejectedComment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: anotherNewComment.id,
      type: ReferenceType.COMMENT,
    });
    await client
      .post('/comments')
      .set('Authorization', `Bearer ${token}`)
      .send(rejectedComment)
      .expect(422);
  });

  context('when dealing with a single persisted comment', () => {
    let persistedComment: Comment;

    beforeEach(async () => {
      persistedComment = await givenCommentInstance(commentRepository, {
        userId: user.id,
        postId: post.id,
        referenceId: post.id,
        type: ReferenceType.POST,
      });
    });

    it('gets a comment by ID', async () => {
      const result = await client
        .get(`/comments/${persistedComment.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      const expected = toJSON(persistedComment);

      expect(result.body).to.deepEqual(expected);
    });

    it('returns 404 when getting a comment that does not exist', () => {
      return client
        .get('/comments/99999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('updates the comments by ID ', async () => {
      const updatedComment: Partial<Comment> = givenComment({
        text: 'Apa kabar dunia',
      });

      delete updatedComment.referenceId;
      delete updatedComment.section;
      delete updatedComment.referenceId;
      delete updatedComment.type;

      await client
        .patch(`/comments/${persistedComment.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedComment)
        .expect(204);

      const result = await commentRepository.findById(persistedComment.id);
      expect(result).to.containEql(updatedComment);
    });

    it('return 401 when updating a comment that does not belong to user', async () => {
      const comment = await givenCommentInstance(commentRepository, {
        userId: otherUser.id,
        postId: post.id,
        referenceId: post.id,
        type: ReferenceType.POST,
      });

      const updatedComment: Partial<Comment> = givenComment({
        text: 'Apa kabar dunia',
      });

      delete updatedComment.referenceId;
      delete updatedComment.section;
      delete updatedComment.referenceId;
      delete updatedComment.type;

      await client
        .patch(`/comments/${comment.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedComment)
        .expect(401);
    });

    it('returns 404 when updating a comment that does not exist', () => {
      const updatedComment: Partial<Comment> = givenComment({
        text: 'Apa kabar dunia',
      });

      delete updatedComment.referenceId;
      delete updatedComment.section;
      delete updatedComment.referenceId;
      delete updatedComment.type;

      return client
        .patch('/comments/99999')
        .set('Authorization', `Bearer ${token}`)
        .send(updatedComment)
        .expect(404);
    });

    it('deletes the comment', async () => {
      await client
        .del(`/comments/${persistedComment.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(204);
      await expect(
        commentRepository.findById(persistedComment.id),
      ).to.be.rejectedWith(EntityNotFoundError);
    });

    it('returns 401 when deletes the comment not belong to user', async () => {
      const comment = await givenCommentInstance(commentRepository, {
        userId: otherUser.id,
        postId: post.id,
        referenceId: post.id,
        type: ReferenceType.POST,
      });
      await client
        .del(`/comments/${comment.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(401);
    });

    it('returns 404 when deleting a comment that does not exist', async () => {
      await client
        .del(`/comments/99999`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  context('when dealing with multiple persisted comments', () => {
    let persistedComments: Comment[];

    beforeEach(async () => {
      persistedComments = await givenMultipleCommentInstances(
        commentRepository,
        {
          userId: user.id,
          postId: post.id,
          referenceId: post.id,
          type: ReferenceType.POST,
        },
      );
    });

    it('finds all comments', async () => {
      const response = await client
        .get('/comments')
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      expect(response.body.data).to.containDeep(toJSON(persistedComments));
    });

    it('queries comments with a filter', async () => {
      const commentInProgress = await givenCommentInstance(commentRepository, {
        text: 'wow',
        userId: user.id,
        postId: post.id,
        referenceId: post.id,
        type: ReferenceType.POST,
      });

      const filter = {
        filter: {
          where: {
            text: 'wow',
          },
        },
      };

      await client
        .get('/comments')
        .set('Authorization', `Bearer ${token}`)
        .query(filter)
        .expect(200, {
          data: [toJSON(commentInProgress)],
          meta: {
            currentPage: 1,
            itemsPerPage: 1,
            totalItemCount: 1,
            totalPageCount: 1,
          },
        });
    });

    it('exploded filter conditions work', async () => {
      await givenCommentInstance(commentRepository, {
        text: 'hello again',
        userId: user.id,
        postId: post.id,
        referenceId: post.id,
        type: ReferenceType.POST,
      });

      const response = await client
        .get('/comments')
        .set('Authorization', `Bearer ${token}`)
        .query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });

  it('includes both user and transaction in query result', async () => {
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: post.id,
      referenceId: post.id,
      type: ReferenceType.POST,
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });
    const filter = {
      filter: {include: ['user', 'transactions']},
    };

    const response = await client
      .get('/comments/')
      .set('Authorization', `Bearer ${token}`)
      .query(filter);

    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0]).to.deepEqual({
      ...toJSON(comment),
      user: toJSON(user),
      transactions: [toJSON(transaction)],
    });
  });
});

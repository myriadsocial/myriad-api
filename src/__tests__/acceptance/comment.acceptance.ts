import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {ReferenceType} from '../../enums';
import {Comment, People, Post, User} from '../../models';
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
  deleteAllRepository,
  givenAccesToken,
  givenActivityLogRepository,
  givenComment,
  givenCommentInstance,
  givenCommentRepository,
  givenMultipleCommentInstances,
  givenNotificationRepository,
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

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('CommentApplication', function () {
  this.timeout(50000);
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
    ({app, client} = await setupApplication(true));
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

  after(async () => {
    await deleteAllRepository(app);
  });

  it('creates a comment', async () => {
    const comment = givenComment({
      userId: user.id.toString(),
      postId: post.id.toString(),
      referenceId: post.id.toString(),
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
        .expect(200);
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
      filter: {include: ['user', 'transactions', 'post']},
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
      post: toJSON(post),
    });
  });
});

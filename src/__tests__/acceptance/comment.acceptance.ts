import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {CommentType, NotificationType, TransactionType} from '../../enums';
import {Comment, Notification, People, Post, User} from '../../models';
import {
  CommentRepository,
  NotificationRepository,
  PeopleRepository,
  PostRepository,
  TransactionRepository,
  UserRepository,
  UserSocialMediaRepository,
} from '../../repositories';
import {
  givenComment,
  givenCommentInstance,
  givenCommentRepository,
  givenMultipleCommentInstances,
  givenNotificationRepository,
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
  let client: Client;
  let userRepository: UserRepository;
  let commentRepository: CommentRepository;
  let postRepository: PostRepository;
  let transactionRepository: TransactionRepository;
  let notificationRepository: NotificationRepository;
  let peopleRepository: PeopleRepository;
  let userSocialMediaRepository: UserSocialMediaRepository;
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
  });

  beforeEach(async () => {
    await commentRepository.deleteAll();
    await userRepository.deleteAll();
    await postRepository.deleteAll();
    await transactionRepository.deleteAll();
    await notificationRepository.deleteAll();
    await peopleRepository.deleteAll();
    await userSocialMediaRepository.deleteAll();
  });

  beforeEach(async () => {
    user = await givenUserInstance(userRepository);
    otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61841',
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
      type: CommentType.POST,
    });

    const response = await client.post('/comments').send(comment).expect(200);
    expect(response.body).to.containDeep(comment);
    const result = await commentRepository.findById(response.body.id);
    expect(result).to.containDeep(comment);
  });

  it('creates a notification when creating a comment', async () => {
    const comment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: post.id,
      type: CommentType.POST,
    });

    const response = await client.post('/comments').send(comment).expect(200);
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
      createdAt: notification?.createdAt,
      updatedAt: notification?.updatedAt,
      deletedAt: undefined,
    });
    expect(expected).to.containDeep(notification);
  });

  it('adds by 1 post metric comments', async () => {
    const comment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: post.id,
      type: CommentType.POST,
    });

    await client.post('/comments').send(comment).expect(200);
    const resultPost = await postRepository.findById(post.id);
    post.metric.comments = post.metric.comments + 1;

    expect(resultPost).to.containDeep(post);
  });

  it('returns 422 when creates a comment with no userId', async () => {
    const comment = givenComment({
      postId: post.id,
      referenceId: post.id,
      type: CommentType.POST,
    });

    await client.post('/comments').send(comment).expect(422);
  });

  it('returns 422 when created a comment with no referenceId and no type', async () => {
    const comment = givenComment({
      userId: user.id,
      postId: post.id,
    });

    delete comment.referenceId;
    delete comment.type;

    await client.post('/comments').send(comment).expect(422);
  });

  it('rejects requests to create a comment with no postId', async () => {
    const comment = givenComment({
      userId: user.id,
      referenceId: post.id,
      type: CommentType.POST,
    });

    await client.post('/comments').send(comment).expect(422);
  });

  context('when dealing with a single persisted comment', () => {
    let persistedComment: Comment;

    beforeEach(async () => {
      persistedComment = await givenCommentInstance(commentRepository, {
        userId: user.id,
        postId: post.id,
        referenceId: post.id,
        type: CommentType.POST,
      });
    });

    it('gets a comment by ID', async () => {
      const result = await client
        .get(`/comments/${persistedComment.id}`)
        .send()
        .expect(200);
      const expected = toJSON(persistedComment);

      expect(result.body).to.deepEqual(expected);
    });

    it('returns 404 when getting a comment that does not exist', () => {
      return client.get('/comments/99999').expect(404);
    });

    it('updates the comments by ID ', async () => {
      const updatedComment = givenComment({
        text: 'Apa kabar dunia',
      });

      await client
        .patch(`/comments/${persistedComment.id}`)
        .send(updatedComment)
        .expect(204);

      const result = await commentRepository.findById(persistedComment.id);
      expect(result).to.containEql(updatedComment);
    });

    it('returns 404 when updating a comment that does not exist', () => {
      return client.patch('/comments/99999').send(givenComment()).expect(404);
    });

    it('deletes the comment', async () => {
      await client.del(`/comments/${persistedComment.id}`).send().expect(204);
      await expect(
        commentRepository.findById(persistedComment.id),
      ).to.be.rejectedWith(EntityNotFoundError);
    });

    it('returns 404 when deleting a comment that does not exist', async () => {
      await client.del(`/comments/99999`).expect(404);
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
          type: CommentType.POST,
        },
      );
    });

    it('finds all comments', async () => {
      const response = await client.get('/comments').send().expect(200);
      expect(response.body.data).to.containDeep(toJSON(persistedComments));
    });

    it('queries comments with a filter', async () => {
      const commentInProgress = await givenCommentInstance(commentRepository, {
        text: 'wow',
        userId: user.id,
        postId: post.id,
        referenceId: post.id,
        type: CommentType.POST,
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
        type: CommentType.POST,
      });

      const response = await client.get('/comments').query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });

  it('includes both user and transaction in query result', async () => {
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: post.id,
      referenceId: post.id,
      type: CommentType.POST,
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: comment.id,
      type: TransactionType.COMMENT,
    });
    const filter =
      'filter=' +
      JSON.stringify({
        include: ['user', 'transactions'],
      });

    const response = await client.get('/comments').query(filter);

    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0]).to.deepEqual({
      ...toJSON(comment),
      user: toJSON(user),
      transactions: [toJSON(transaction)],
    });
  });
});

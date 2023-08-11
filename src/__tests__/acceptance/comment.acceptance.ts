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
  this.timeout(100000);
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
    user = await givenUserInstance(userRepository, {fullAccess: true});
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
      .post('/user/comments')
      .set('Authorization', `Bearer ${token}`)
      .send(comment)
      .expect(200);
    expect(response.body).to.containDeep(comment);
    const result = await commentRepository.findById(response.body.id);
    expect(result).to.containDeep(comment);
  });

  it('reject creates a comment in lite version when action is fulfilled', async () => {
    await userRepository.updateById(user.id, {fullAccess: false});
    for (let i = 0; i <= 50; i++) {
      await givenCommentInstance(commentRepository, {
        userId: user.id,
        postId: post.id.toString(),
        referenceId: post.id.toString(),
        type: ReferenceType.POST,
      });
    }
    const comment = givenComment({
      userId: user.id.toString(),
      postId: post.id.toString(),
      referenceId: post.id.toString(),
      type: ReferenceType.POST,
    });

    await client
      .post('/user/comments')
      .set('Authorization', `Bearer ${token}`)
      .send(comment)
      .expect(422);
    await userRepository.updateById(user.id, {fullAccess: true});
  });

  it('returns 422 when created a comment with no referenceId and no type', async () => {
    const comment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: undefined,
      type: undefined,
    });

    await client
      .post('/user/comments')
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
      .post('/user/comments')
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

    it('deletes the comment', async () => {
      await client
        .del(`/user/comments/${persistedComment.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
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
        .get(`/user/comments?referenceId=${post.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      expect(response.body.data).to.containDeep(toJSON(persistedComments));
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
        .get(`/user/comments?postId=${post.id}&referenceId=${post.id}`)
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
      currencyId: '1',
    });
    const filter = {
      filter: {include: ['user', 'transactions', 'post']},
    };

    const response = await client
      .get(`/user/comments?postId=${post.id}&referenceId=${post.id}`)
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

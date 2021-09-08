import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {CommentType, NotificationType, TransactionType} from '../../enums';
import {Comment, Notification, People, Post, User} from '../../models';
import {
  CommentLinkRepository,
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
  givenCommentInstanceOfPost,
  givenCommentLinkRepository,
  givenCommentRepository,
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

describe('PostCommentApplication', function () {
  let app: MyriadApiApplication;
  let client: Client;
  let userRepository: UserRepository;
  let commentRepository: CommentRepository;
  let postRepository: PostRepository;
  let transactionRepository: TransactionRepository;
  let peopleRepository: PeopleRepository;
  let notificationRepository: NotificationRepository;
  let userSocialMediaRepository: UserSocialMediaRepository;
  let commentLinkRepository: CommentLinkRepository;
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
    commentLinkRepository = await givenCommentLinkRepository(app);
  });

  beforeEach(async () => {
    await commentRepository.deleteAll();
    await userRepository.deleteAll();
    await postRepository.deleteAll();
    await transactionRepository.deleteAll();
    await notificationRepository.deleteAll();
    await peopleRepository.deleteAll();
    await userSocialMediaRepository.deleteAll();
    await commentLinkRepository.deleteAll();
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

  it('creates a comment for a post', async function () {
    const comment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: undefined,
      type: undefined,
    });

    const response = await client
      .post(`/posts/${post.id}/comments`)
      .send(comment)
      .expect(200);
    const createdComment = Object.assign(response.body, {
      createdAt: undefined,
      updatedAt: undefined,
    });
    const expected = Object.assign(comment, {
      referenceId: post.id,
      type: CommentType.POST,
    });
    expect(toJSON(createdComment)).to.containEql(expected);
    const created = await commentRepository.findById(response.body.id);
    delete created.createdAt;
    delete created.updatedAt;
    delete created.deletedAt;
    expect(created).to.deepEqual(
      Object.assign(expected, {id: response.body.id}),
    );
  });

  it('creates a notification when creating a comment for a comment', async () => {
    const comment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: undefined,
      type: undefined,
    });

    const response = await client
      .post(`/posts/${post.id}/comments`)
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
      referenceId: undefined,
      type: undefined,
    });

    await client.post(`/posts/${post.id}/comments`).send(comment).expect(200);
    const resultPost = await postRepository.findById(post.id);
    post.metric.comments = (
      await commentRepository.count({postId: post.id})
    ).count;

    expect(resultPost).to.containDeep(post);
  });

  it('returns 422 when creates a comment in post with no userId', async () => {
    const comment = givenComment({
      referenceId: undefined,
      type: undefined,
    });

    await client.post(`/posts/${post.id}/comments`).send(comment).expect(422);
  });

  context('when dealing with multiple persisted comments in post', () => {
    let myComment: Comment[];
    let notMyComment: Comment;

    beforeEach(async () => {
      notMyComment = await givenCommentInstance(commentRepository, {
        postId: '9999',
        userId:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618521',
        type: CommentType.POST,
      });
      myComment = await Promise.all([
        givenCommentInstance(commentRepository, {
          userId: user.id,
          referenceId: post.id,
          type: CommentType.POST,
          postId: post.id,
        }),
        givenCommentInstance(commentRepository, {
          text: 'Hello world',
          userId: user.id,
          referenceId: post.id,
          type: CommentType.POST,
          postId: post.id,
        }),
      ]);
    });

    it('finds all comments', async () => {
      const response = await client
        .get(`/posts/${post.id}/comments`)
        .send()
        .expect(200);
      expect(response.body.data)
        .to.containDeep(toJSON(myComment))
        .and.not.containEql(notMyComment.toJSON);
    });

    it('finds comments for a post more than once', async () => {
      await client.get(`/posts/${post.id}/comments`).send().expect(200);
      await client.get(`/posts/${post.id}/comments`).send().expect(200);
    });

    it('updates comments for a post', async () => {
      const patchedIsCompleteComment = {text: 'amazing'};
      const response = await client
        .patch(`/posts/${post.id}/comments`)
        .send(patchedIsCompleteComment)
        .expect(200);

      expect(response.body.count).to.eql(myComment.length);
      const updatedComments = await postRepository.comments(post.id).find();
      const notUpdatedTComment = await commentRepository.findById(
        notMyComment.id,
      );
      for (const comment of updatedComments) {
        expect(comment.toJSON()).to.containEql(patchedIsCompleteComment);
      }
      expect(notUpdatedTComment.toJSON()).to.not.containEql(
        patchedIsCompleteComment,
      );
    });

    it('updates comments matching "where" condition', async () => {
      await commentRepository.deleteAll();
      const wip = await givenCommentInstanceOfPost(postRepository, post.id, {
        text: 'test',
        userId: user.id,
        postId: post.id,
      });
      const done = await givenCommentInstanceOfPost(postRepository, post.id, {
        text: 'test2',
        userId: user.id,
        postId: post.id,
      });

      const response = await client
        .patch(`/posts/${post.id}/comments`)
        .query({where: {text: 'test'}})
        .send({text: 'test3'});

      // .expect(200);
      expect(response.body.count).to.equal(1);

      // the matched Todo was updated
      expect(await commentRepository.findById(wip.id)).to.have.property(
        'text',
        'test3',
      );

      // the other Todo was not modified
      expect(await commentRepository.findById(done.id)).to.have.property(
        'text',
        'test2',
      );
    });

    it('deletes all comments in a post', async () => {
      await client.del(`/posts/${post.id}/comments`).send().expect(200);

      const myDeletedComments = await postRepository.comments(post.id).find();
      const notDeletedComment = await commentRepository.findById(
        notMyComment.id,
      );
      expect(myDeletedComments).to.be.empty();
      expect(notDeletedComment).to.eql(notMyComment);
    });

    it('queries comments in post with a filter', async () => {
      const commentInProgress = await givenCommentInstance(commentRepository, {
        text: 'wow',
        userId: user.id,
        referenceId: post.id,
        type: CommentType.POST,
        postId: post.id,
      });

      const filter = {
        filter: {
          where: {
            text: 'wow',
          },
        },
      };

      await client
        .get(`/posts/${post.id}/comments`)
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
        referenceId: post.id,
        type: CommentType.POST,
        postId: post.id,
      });

      const response = await client
        .get(`/posts/${post.id}/comments`)
        .query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });

  it('includes user, transactions, comments in query result', async () => {
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      referenceId: post.id,
      type: CommentType.POST,
      postId: post.id,
    });
    const otherComment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      referenceId: comment.id,
      type: CommentType.COMMENT,
      postId: post.id,
    });

    await commentLinkRepository.create({
      fromCommentId: comment.id,
      toCommentId: otherComment.id,
    });

    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: comment.id,
      type: TransactionType.COMMENT,
    });
    const filter = {
      filter: {
        include: ['user', 'transactions', 'comments'],
      },
    };

    const response = await client
      .get(`/posts/${post.id}/comments`)
      .query(filter);

    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0]).to.deepEqual({
      ...toJSON(comment),
      user: toJSON(user),
      transactions: [toJSON(transaction)],
      comments: [toJSON(otherComment)],
    });
  });
});

import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {TransactionType} from '../../enums';
import {Comment, Post, User} from '../../models';
import {
  CommentRepository,
  PostRepository,
  TransactionRepository,
  UserRepository,
} from '../../repositories';
import {
  givenComment,
  givenCommentInstance,
  givenCommentRepository,
  givenMultipleCommentInstances,
  givenPostInstance,
  givenPostRepository,
  givenTransactionInstance,
  givenTransactionRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';

describe('CommentApplication', function () {
  let app: MyriadApiApplication;
  let client: Client;
  let userRepository: UserRepository;
  let commentRepository: CommentRepository;
  let postRepository: PostRepository;
  let transactionRepository: TransactionRepository;
  let user: User;
  let post: Post;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    userRepository = await givenUserRepository(app);
    commentRepository = await givenCommentRepository(app);
    postRepository = await givenPostRepository(app);
    transactionRepository = await givenTransactionRepository(app);
  });

  beforeEach(async () => {
    await commentRepository.deleteAll();
    await userRepository.deleteAll();
    await postRepository.deleteAll();
    await transactionRepository.deleteAll();
  });

  beforeEach(async () => {
    user = await givenUserInstance(userRepository);
    post = await givenPostInstance(postRepository, {
      createdBy: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61859',
    });
  });

  it('creates a comment', async function () {
    const comment = givenComment({userId: user.id, postId: post.id});

    const response = await client.post('/comments').send(comment).expect(200);
    expect(response.body).to.containDeep(comment);
    const result = await commentRepository.findById(response.body.id);
    expect(result).to.containDeep(comment);
  });

  it('adds by 1 post metric comments', async () => {
    const comment = givenComment({userId: user.id, postId: post.id});

    await client.post('/comments').send(comment).expect(200);
    const resultPost = await postRepository.findById(post.id);
    post.metric.comments = post.metric.comments + 1;

    expect(resultPost).to.containDeep(post);
  });

  it('returns 422 when creates a comment with no userId', async () => {
    const comment = givenComment({postId: post.id});

    await client.post('/comments').send(comment).expect(422);
  });

  it('rejects requests to create a comment with no postId', async () => {
    const comment = givenComment({userId: user.id});

    await client.post('/comments').send(comment).expect(422);
  });

  context('when dealing with a single persisted comment', () => {
    let persistedComment: Comment;

    beforeEach(async () => {
      persistedComment = await givenCommentInstance(commentRepository, {
        userId: user.id,
        postId: post.id,
      });
    });

    it('gets a comment by ID', async () => {
      const result = await client.get(`/comments/${persistedComment.id}`).send().expect(200);
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

      await client.patch(`/comments/${persistedComment.id}`).send(updatedComment).expect(204);

      const result = await commentRepository.findById(persistedComment.id);
      expect(result).to.containEql(updatedComment);
    });

    it('returns 404 when updating a comment that does not exist', () => {
      return client.patch('/comments/99999').send(givenComment()).expect(404);
    });

    it('deletes the comment', async () => {
      await client.del(`/comments/${persistedComment.id}`).send().expect(204);
      await expect(commentRepository.findById(persistedComment.id)).to.be.rejectedWith(
        EntityNotFoundError,
      );
    });

    it('returns 404 when deleting a comment that does not exist', async () => {
      await client.del(`/comments/99999`).expect(404);
    });
  });

  context('when dealing with multiple persisted comments', () => {
    let persistedComments: Comment[];

    beforeEach(async () => {
      persistedComments = await givenMultipleCommentInstances(commentRepository, {
        userId: user.id,
        postId: post.id,
      });
    });

    it('finds all comments', async () => {
      const response = await client.get('/comments').send().expect(200);
      expect(response.body.data).to.containDeep(persistedComments);
    });

    it('queries comments with a filter', async () => {
      const commentInProgress = await givenCommentInstance(commentRepository, {
        text: 'wow',
        userId: user.id,
        postId: post.id,
      });

      await client
        .get('/comments')
        .query('filter=' + JSON.stringify({where: {text: 'wow'}}))
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
      });

      const response = await client.get('/comments').query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });

  it('includes user, transaction, and post in query result', async () => {
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: post.id,
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: comment.id,
      type: TransactionType.COMMENT,
    });
    const filter =
      'filter=' +
      JSON.stringify({
        include: ['user', 'post', 'transactions'],
      });

    const response = await client.get('/comments').query(filter);

    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0]).to.deepEqual({
      ...toJSON(comment),
      user: toJSON(user),
      post: toJSON(post),
      transactions: [toJSON(transaction)],
    });
  });
});

import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {SectionType} from '../../enums';
import {User} from '../../models';
import {
  CommentRepository,
  VoteRepository,
  PostRepository,
  UserRepository,
} from '../../repositories';
import {
  givenComment,
  givenCommentRepository,
  givenVoteRepository,
  givenPostInstance,
  givenPostRepository,
  setupApplication,
  givenVote,
  givenVoteInstance,
  givenUserRepository,
  givenUserInstance,
  givenOtherUser,
  givenAccesToken,
  deleteAllRepository,
} from '../helpers';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('VoteApplication', function () {
  this.timeout(30000);

  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let voteRepository: VoteRepository;
  let postRepository: PostRepository;
  let commentRepository: CommentRepository;
  let userRepository: UserRepository;
  let user: User;
  let otherUser: User;

  before(async () => {
    ({app, client} = await setupApplication(true));
  });

  after(() => app.stop());

  before(async () => {
    voteRepository = await givenVoteRepository(app);
    postRepository = await givenPostRepository(app);
    commentRepository = await givenCommentRepository(app);
    userRepository = await givenUserRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    otherUser = await givenUserInstance(userRepository, givenOtherUser());
    token = await givenAccesToken(user);
  });

  beforeEach(async () => {
    await voteRepository.deleteAll();
    await postRepository.deleteAll();
    await commentRepository.deleteAll();
  });

  after(async () => {
    await deleteAllRepository(app);
  });

  it('creates an upvote if not exists', async function () {
    const userPost = await givenUserInstance(userRepository, {
      username: 'johndoe',
    });
    const postResponse = await givenPostInstance(
      postRepository,
      {
        metric: {
          discussions: 0,
          upvotes: 0,
          downvotes: 0,
          debates: 0,
        },
        createdBy: userPost.id.toString(),
      },
      true,
    );
    const post = postResponse.ops[0];
    const upvote = givenVote({
      referenceId: post._id.toString(),
      postId: post._id.toString(),
      userId: user.id.toString(),
    });
    const response = await client
      .post('/votes')
      .set('Authorization', `Bearer ${token}`)
      .send(upvote)
      .expect(200);
    expect(response.body).to.containDeep(upvote);
    const result = await voteRepository.findById(response.body.id);
    expect(result).to.containDeep(upvote);
  });

  it('can downvotes post if user already comments to the post in the debate section', async () => {
    const postResponse = await givenPostInstance(
      postRepository,
      {
        metric: {
          discussions: 0,
          upvotes: 0,
          downvotes: 0,
          debates: 0,
        },
        createdBy: user.id.toString(),
      },
      true,
    );
    const post = postResponse.ops[0];
    const comment = givenComment({
      postId: post._id.toString(),
      referenceId: post._id.toString(),
      userId: user.id,
      section: SectionType.DEBATE,
    });
    await client
      .post('/comments')
      .set('Authorization', `Bearer ${token}`)
      .send(comment)
      .expect(200);
    const downvote = givenVote({
      referenceId: post._id.toString(),
      state: false,
      userId: user.id.toString(),
      postId: post._id.toString(),
    });
    const response = await client
      .post('/votes')
      .set('Authorization', `Bearer ${token}`)
      .send(downvote)
      .expect(200);
    expect(response.body).to.containDeep(downvote);
    const result = await voteRepository.findById(response.body.id);
    expect(result).to.containDeep(downvote);
  });

  it('adds by 1 upvotes', async () => {
    const userPost = await givenUserInstance(userRepository, {
      username: 'irman',
    });

    const postResponse = (
      await givenPostInstance(
        postRepository,
        {
          metric: {
            discussions: 0,
            upvotes: 0,
            downvotes: 0,
            debates: 0,
          },
          createdBy: userPost.id,
        },
        true,
      )
    ).ops[0];
    const post = Object.assign(postResponse, {
      id: postResponse._id.toString(),
      _id: undefined,
    });

    const upvote = givenVote({
      referenceId: post.id,
      postId: post.id,
      userId: user.id,
    });
    const response = await client
      .post('/votes')
      .set('Authorization', `Bearer ${token}`)
      .send(upvote);

    const resultPost = await postRepository.findById(response.body.postId);
    post.metric.upvotes = post.metric.upvotes + 1;
    expect(resultPost).to.containDeep(post);
  });

  it('rejects to downvote the post if user has not comment in debate section', async () => {
    const userPost = await givenUserInstance(userRepository, {
      username: 'imam',
    });
    const postResponse = (
      await givenPostInstance(
        postRepository,
        {
          metric: {
            discussions: 0,
            upvotes: 0,
            downvotes: 0,
            debates: 0,
          },
          createdBy: userPost.id,
        },
        true,
      )
    ).ops[0];
    const post = Object.assign(postResponse, {
      id: postResponse._id.toString(),
      _id: undefined,
    });

    const downvote = givenVote({
      referenceId: post.id,
      state: false,
      postId: post.id,
      userId: user.id,
    });
    await client
      .post('/votes')
      .set('Authorization', `Bearer ${token}`)
      .send(downvote)
      .expect(422);
  });

  it('returns 401 when deleting the upvotes not as login user', async function () {
    const accesToken = await givenAccesToken(otherUser);
    const postResponse = await givenPostInstance(
      postRepository,
      {
        metric: {
          discussions: 0,
          upvotes: 1,
          downvotes: 0,
          debates: 0,
        },
        createdBy: user.id,
      },
      true,
    );
    const post = postResponse.ops[0];
    const vote = await givenVoteInstance(voteRepository, {
      referenceId: post._id.toString(),
      postId: post._id.toString(),
      userId: user.id,
    });

    await client
      .del(`/votes/${vote.id}`)
      .set('Authorization', `Bearer ${accesToken}`)
      .send()
      .expect(401);
  });

  it('deletes the upvotes and post metric upvotes reduces by 1', async function () {
    const postResponse = await givenPostInstance(
      postRepository,
      {
        metric: {
          discussions: 0,
          upvotes: 1,
          downvotes: 0,
          debates: 0,
        },
        createdBy: user.id,
      },
      true,
    );
    const post = postResponse.ops[0];
    const vote = await givenVoteInstance(voteRepository, {
      referenceId: post._id.toString(),
      postId: post._id.toString(),
      userId: user.id,
    });

    await client
      .del(`/votes/${vote.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send()
      .expect(204);
    await expect(voteRepository.findById(vote.id)).to.be.rejectedWith(
      EntityNotFoundError,
    );

    const resultPost = await postRepository.findById(vote.referenceId);
    post.metric.upvotes = post.metric.upvotes - 1;
    expect(resultPost.metric.upvotes).to.equal(post.metric.upvotes);
  });
});

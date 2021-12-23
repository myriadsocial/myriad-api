import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {SectionType} from '../../enums';
import {
  CommentRepository,
  VoteRepository,
  PostRepository,
  UserRepository,
  AuthenticationRepository,
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
  givenAuthenticationRepository,
  givenUserInstance,
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
  let authenticationRepository: AuthenticationRepository;

  const userCredential = {
    email: 'admin@mail.com',
    password: '123456',
  };

  before(async () => {
    ({app, client} = await setupApplication(true));
  });

  after(() => app.stop());

  before(async () => {
    authenticationRepository = await givenAuthenticationRepository(app);
    voteRepository = await givenVoteRepository(app);
    postRepository = await givenPostRepository(app);
    commentRepository = await givenCommentRepository(app);
    userRepository = await givenUserRepository(app);
  });

  after(async () => {
    await authenticationRepository.deleteAll();
  });

  beforeEach(async () => {
    await voteRepository.deleteAll();
    await postRepository.deleteAll();
    await commentRepository.deleteAll();
    await userRepository.deleteAll();
  });

  it('sign up successfully', async () => {
    await client.post('/signup').send(userCredential).expect(200);
  });

  it('user login successfully', async () => {
    const res = await client.post('/login').send(userCredential).expect(200);
    token = res.body.accessToken;
  });

  it('creates an upvote if not exists', async function () {
    const user = await givenUserInstance(userRepository);
    const postResponse = await givenPostInstance(
      postRepository,
      {
        metric: {
          discussions: 0,
          upvotes: 0,
          downvotes: 0,
          debates: 0,
        },
        createdBy: user.id,
      },
      true,
    );
    const post = postResponse.ops[0];
    const upvote = givenVote({
      referenceId: post._id.toString(),
      postId: post._id.toString(),
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
    const otherUser = await givenUserInstance(userRepository, {
      name: 'Kirania Maryam',
      username: 'kiraniamaryam',
    });

    const user = await givenUserInstance(userRepository);
    const postResponse = await givenPostInstance(
      postRepository,
      {
        metric: {
          discussions: 0,
          upvotes: 0,
          downvotes: 0,
          debates: 0,
        },
        createdBy: user.id,
      },
      true,
    );
    const post = postResponse.ops[0];
    const comment = givenComment({
      postId: post._id.toString(),
      referenceId: post._id.toString(),
      userId: otherUser.id.toString(),
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
      userId: otherUser.id.toString(),
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
    const user = await givenUserInstance(userRepository);
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
          createdBy: user.id,
        },
        true,
      )
    ).ops[0];
    const post = Object.assign(postResponse, {
      id: postResponse._id.toString(),
      _id: undefined,
    });

    const upvote = givenVote({referenceId: post.id, postId: post.id});
    const response = await client
      .post('/votes')
      .set('Authorization', `Bearer ${token}`)
      .send(upvote);

    const resultPost = await postRepository.findById(response.body.referenceId);
    post.metric.upvotes = post.metric.upvotes + 1;
    expect(resultPost).to.containDeep(post);
  });

  it('rejects to downvote the post if user has not comment in debate section', async () => {
    const user = await givenUserInstance(userRepository);
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
          createdBy: user.id,
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
    });
    await client
      .post('/votes')
      .set('Authorization', `Bearer ${token}`)
      .send(downvote)
      .expect(422);
  });

  it('deletes the upvotes and post metric upvotes reduces by 1', async function () {
    const user = await givenUserInstance(userRepository);
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

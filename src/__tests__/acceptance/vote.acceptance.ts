import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {SectionType} from '../../enums';
import {
  CommentRepository,
  VoteRepository,
  PostRepository,
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
} from '../helpers';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('VoteApplication', function () {
  this.timeout(5000);
  let app: MyriadApiApplication;
  let client: Client;
  let voteRepository: VoteRepository;
  let postRepository: PostRepository;
  let commentRepository: CommentRepository;

  before(async () => {
    ({app, client} = await setupApplication(true));
  });

  after(() => app.stop());

  before(async () => {
    voteRepository = await givenVoteRepository(app);
    postRepository = await givenPostRepository(app);
    commentRepository = await givenCommentRepository(app);
  });

  beforeEach(async () => {
    await voteRepository.deleteAll();
    await postRepository.deleteAll();
    await commentRepository.deleteAll();
  });

  it('creates an upvote if not exists', async function () {
    const postResponse = await givenPostInstance(
      postRepository,
      {
        metric: {
          discussions: 0,
          upvotes: 0,
          downvotes: 0,
          debates: 0,
        },
      },
      true,
    );
    const post = postResponse.ops[0];
    const upvote = givenVote({referenceId: post._id.toString()});
    const response = await client.post('/votes').send(upvote).expect(200);
    expect(response.body).to.containDeep(upvote);
    const result = await voteRepository.findById(response.body.id);
    expect(result).to.containDeep(upvote);
  });

  it('can downvotes post if user already comments to the post in the debate section', async function () {
    const postResponse = await givenPostInstance(
      postRepository,
      {
        metric: {
          discussions: 0,
          upvotes: 0,
          downvotes: 0,
          debates: 0,
        },
      },
      true,
    );
    const post = postResponse.ops[0];
    const comment = givenComment({
      postId: post._id.toString(),
      referenceId: post._id.toString(),
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61841',
      section: SectionType.DEBATE,
    });
    await client.post('/comments').send(comment).expect(200);
    const downvote = givenVote({
      referenceId: post._id.toString(),
      state: false,
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61841',
    });
    const response = await client.post('/votes').send(downvote).expect(200);
    expect(response.body).to.containDeep(downvote);
    const result = await voteRepository.findById(response.body.id);
    expect(result).to.containDeep(downvote);
  });

  it('adds by 1 upvotes', async function () {
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
        },
        true,
      )
    ).ops[0];
    const post = Object.assign(postResponse, {
      id: postResponse._id.toString(),
      _id: undefined,
    });

    const upvote = givenVote({referenceId: post.id});
    const response = await client.post('/votes').send(upvote);

    const resultPost = await postRepository.findById(response.body.referenceId);
    post.metric.upvotes = post.metric.upvotes + 1;
    expect(resultPost).to.containDeep(post);
  });

  it('rejects to downvote the post if user has not comment in debate section', async () => {
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
        },
        true,
      )
    ).ops[0];
    const post = Object.assign(postResponse, {
      id: postResponse._id.toString(),
      _id: undefined,
    });

    const downvote = givenVote({referenceId: post.id, state: false});
    await client.post('/votes').send(downvote).expect(422);
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
      },
      true,
    );
    const post = postResponse.ops[0];
    const vote = await givenVoteInstance(voteRepository, {
      referenceId: post._id.toString(),
    });

    await client.del(`/votes/${vote.id}`).send().expect(204);
    await expect(voteRepository.findById(vote.id)).to.be.rejectedWith(
      EntityNotFoundError,
    );

    const resultPost = await postRepository.findById(vote.referenceId);
    post.metric.upvotes = post.metric.upvotes - 1;
    expect(resultPost.metric.upvotes).to.equal(post.metric.upvotes);
  });
});

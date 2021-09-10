import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {SectionType} from '../../enums';
import {
  CommentRepository,
  LikeRepository,
  PostRepository,
} from '../../repositories';
import {
  givenComment,
  givenCommentRepository,
  givenLike,
  givenLikeInstance,
  givenLikeRepository,
  givenPostInstance,
  givenPostRepository,
  setupApplication,
} from '../helpers';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('LikeApplication', function () {
  this.timeout(5000);
  let app: MyriadApiApplication;
  let client: Client;
  let likeRepository: LikeRepository;
  let postRepository: PostRepository;
  let commentRepository: CommentRepository;

  before(async () => {
    ({app, client} = await setupApplication(true));
  });

  after(() => app.stop());

  before(async () => {
    likeRepository = await givenLikeRepository(app);
    postRepository = await givenPostRepository(app);
    commentRepository = await givenCommentRepository(app);
  });

  beforeEach(async () => {
    await likeRepository.deleteAll();
    await postRepository.deleteAll();
    await commentRepository.deleteAll();
  });

  it('creates a like if not exists', async function () {
    const postResponse = await givenPostInstance(
      postRepository,
      {
        metric: {
          discussions: 0,
          likes: 0,
          dislikes: 0,
          debates: 0,
        },
      },
      true,
    );
    const post = postResponse.ops[0];
    const like = givenLike({referenceId: post._id.toString()});
    const response = await client.post('/likes').send(like).expect(200);
    expect(response.body).to.containDeep(like);
    const result = await likeRepository.findById(response.body.id);
    expect(result).to.containDeep(like);
  });

  it('can dislike post if user already comments to the post in the debate section', async function () {
    const postResponse = await givenPostInstance(
      postRepository,
      {
        metric: {
          discussions: 0,
          likes: 0,
          dislikes: 0,
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
    const like = givenLike({
      referenceId: post._id.toString(),
      state: false,
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61841',
    });
    const response = await client.post('/likes').send(like).expect(200);
    expect(response.body).to.containDeep(like);
    const result = await likeRepository.findById(response.body.id);
    expect(result).to.containDeep(like);
  });

  it('adds by 1 post metric likes', async function () {
    const postResponse = (
      await givenPostInstance(
        postRepository,
        {
          metric: {
            discussions: 0,
            likes: 0,
            dislikes: 0,
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

    const like = givenLike({referenceId: post.id});
    const response = await client.post('/likes').send(like);

    const resultPost = await postRepository.findById(response.body.referenceId);
    post.metric.likes = post.metric.likes + 1;
    expect(resultPost).to.containDeep(post);
  });

  it('rejects to dislike the post if user has not comment in debate section', async () => {
    const postResponse = (
      await givenPostInstance(
        postRepository,
        {
          metric: {
            discussions: 0,
            likes: 0,
            dislikes: 0,
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

    const like = givenLike({referenceId: post.id, state: false});
    await client.post('/likes').send(like).expect(422);
  });

  it('deletes the like and post metric likes reduces by 1', async function () {
    const postResponse = await givenPostInstance(
      postRepository,
      {
        metric: {
          discussions: 0,
          likes: 1,
          dislikes: 0,
          debates: 0,
        },
      },
      true,
    );
    const post = postResponse.ops[0];
    const like = await givenLikeInstance(likeRepository, {
      referenceId: post._id.toString(),
    });

    await client.del(`/likes/${like.id}`).send().expect(204);
    await expect(likeRepository.findById(like.id)).to.be.rejectedWith(
      EntityNotFoundError,
    );

    const resultPost = await postRepository.findById(like.referenceId);
    post.metric.likes = post.metric.likes - 1;
    expect(resultPost.metric.likes).to.equal(post.metric.likes);
  });
});

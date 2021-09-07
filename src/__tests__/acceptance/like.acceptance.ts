import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {LikeRepository, PostRepository} from '../../repositories';
import {
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

  before(async () => {
    ({app, client} = await setupApplication(true));
  });

  after(() => app.stop());

  before(async () => {
    likeRepository = await givenLikeRepository(app);
    postRepository = await givenPostRepository(app);
  });

  beforeEach(async () => {
    await likeRepository.deleteAll();
    await postRepository.deleteAll();
  });

  it('creates a like if not exists', async function () {
    const postResponse = await givenPostInstance(
      postRepository,
      {
        metric: {
          comments: 0,
          likes: 0,
          dislikes: 0,
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

  it('updates a like if exists', async function () {
    const postResponse = await givenPostInstance(
      postRepository,
      {
        metric: {
          comments: 0,
          likes: 0,
          dislikes: 0,
        },
      },
      true,
    );
    const post = postResponse.ops[0];
    await givenLikeInstance(likeRepository, {referenceId: post._id.toString()});

    const like = givenLike({referenceId: post._id.toString(), state: false});
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
            comments: 0,
            likes: 0,
            dislikes: 0,
          },
        },
        true,
      )
    ).ops[0];
    const id = postResponse._id.toString();
    delete postResponse._id;
    const post = {
      id,
      ...postResponse,
    };

    const like = givenLike({referenceId: post.id});
    const response = await client.post('/likes').send(like);

    sleep(500);
    const resultPost = await postRepository.findById(response.body.referenceId);
    post.metric.likes = post.metric.likes + 1;
    expect(resultPost).to.containDeep(post);
  });

  it('deletes the like and post metric likes reduces by 1', async function () {
    const postResponse = await givenPostInstance(
      postRepository,
      {
        metric: {
          comments: 0,
          likes: 1,
          dislikes: 0,
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

    sleep(500);
    const resultPost = await postRepository.findById(like.referenceId);
    post.metric.likes = post.metric.likes - 1;
    expect(resultPost.metric.likes).to.equal(post.metric.likes);
  });
});

function sleep(milliseconds: number) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}

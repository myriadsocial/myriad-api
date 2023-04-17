import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {NotificationType, SectionType} from '../../enums';
import {User} from '../../models';
import {
  CommentRepository,
  VoteRepository,
  PostRepository,
  UserRepository,
  NotificationRepository,
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
  givenAccesToken,
  deleteAllRepository,
  givenNotificationRepository,
  givenNotification,
} from '../helpers';
import {omit} from 'lodash';

/* eslint-disable  @typescript-eslint/no-invalid-this */
/* eslint-disable  @typescript-eslint/no-misused-promises */
describe('VoteApplication', function () {
  this.timeout(100000);

  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let voteRepository: VoteRepository;
  let postRepository: PostRepository;
  let commentRepository: CommentRepository;
  let userRepository: UserRepository;
  let notificationRepository: NotificationRepository;
  let user: User;

  before(async () => {
    ({app, client} = await setupApplication(true));
  });

  after(() => app.stop());

  before(async () => {
    voteRepository = await givenVoteRepository(app);
    postRepository = await givenPostRepository(app);
    commentRepository = await givenCommentRepository(app);
    userRepository = await givenUserRepository(app);
    notificationRepository = await givenNotificationRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
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
      .post('/user/votes')
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
      .post('/user/comments')
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
      .post('/user/votes')
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
    const post = Object.assign(omit(postResponse, ['_id']), {
      id: postResponse._id.toString(),
    });

    const upvote = givenVote({
      referenceId: post.id,
      postId: post.id,
      userId: user.id,
    });
    const response = await client
      .post('/user/votes')
      .set('Authorization', `Bearer ${token}`)
      .send(upvote);

    setTimeout(async () => {
      const resultPost = await postRepository.findById(response.body.postId);
      post.metric.upvotes = post.metric.upvotes + 1;
      expect(resultPost).to.containDeep(post);
    }, 10000);
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
      .post('/user/votes')
      .set('Authorization', `Bearer ${token}`)
      .send(downvote)
      .expect(422);
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
      .del(`/user/votes/${vote.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send()
      .expect(200);
    await expect(voteRepository.findById(vote.id)).to.be.rejectedWith(
      EntityNotFoundError,
    );

    setTimeout(async () => {
      const resultPost = await postRepository.findById(vote.referenceId);
      post.metric.upvotes = post.metric.upvotes - 1;
      expect(resultPost.metric.upvotes).to.equal(post.metric.upvotes);
    }, 10000);
  });

  it('send notification at 5 upvotes', async () => {
    const userPost = await givenUserInstance(userRepository, {
      username: 'alexander',
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
    const post = Object.assign(omit(postResponse, ['_id']), {
      id: postResponse._id.toString(),
    });
    const userInstances = await Promise.all([
      givenUserInstance(userRepository, {
        username: 'alpha',
      }),
      givenUserInstance(userRepository, {
        username: 'beta',
      }),
      givenUserInstance(userRepository, {
        username: 'gamma',
      }),
      givenUserInstance(userRepository, {
        username: 'epsilon',
      }),
    ]);
    const voteInstances = await Promise.all([
      givenVoteInstance(voteRepository, {
        referenceId: post.id,
        postId: post.id,
        userId: userInstances[0].id,
      }),
      givenVoteInstance(voteRepository, {
        referenceId: post.id,
        postId: post.id,
        userId: userInstances[1].id,
      }),
      givenVoteInstance(voteRepository, {
        referenceId: post.id,
        postId: post.id,
        userId: userInstances[2].id,
      }),
      givenVoteInstance(voteRepository, {
        referenceId: post.id,
        postId: post.id,
        userId: userInstances[3].id,
      }),
    ]);
    const notifInstances = givenNotification({
      type: NotificationType.VOTE_COUNT,
      message: '5',
      referenceId: post.id,
    });
    const notifInstance = Object.assign(omit(notifInstances, ['from']), {
      to: userPost.id,
    });

    const upvote = givenVote({
      referenceId: post.id,
      postId: post.id,
      userId: user.id,
    });
    const response = await client
      .post('/user/votes')
      .set('Authorization', `Bearer ${token}`)
      .send(upvote);

    console.log(response.body.postId);
    console.log(voteInstances);

    setTimeout(async () => {
      const resultNotification = await notificationRepository.find({
        where: {type: NotificationType.VOTE_COUNT},
      });
      expect(resultNotification).to.containDeep(notifInstance);
    }, 10000);
  });
});

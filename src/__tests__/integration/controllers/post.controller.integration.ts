import {expect, toJSON} from '@loopback/testlab';
import {PostController} from '../../../controllers';
import {RedditDataSource} from '../../../datasources';
import {ReferenceType} from '../../../enums';
import {
  CommentRepository,
  VoteRepository,
  PeopleRepository,
  PostRepository,
  TransactionRepository,
  UserRepository,
} from '../../../repositories';
import {
  Facebook,
  PostService,
  Reddit,
  RedditProvider,
  SocialMediaService,
  Twitter,
} from '../../../services';
import {UrlUtils} from '../../../utils/url.utils';
import {
  givenCommentInstance,
  givenEmptyDatabase,
  givenVoteInstance,
  givenPeopleInstance,
  givenPlatformPost,
  givenPostInstance,
  givenRepositories,
  givenTransactionInstance,
  givenUserInstance,
  testdb,
} from '../../helpers';

describe('PostControllerIntegration', () => {
  let postRepository: PostRepository;
  let socialMediaService: SocialMediaService;
  let redditService: Reddit;
  let twitterService: Twitter;
  let facebookService: Facebook;
  let postService: PostService;
  let peopleRepository: PeopleRepository;
  let userRepository: UserRepository;
  let commentRepository: CommentRepository;
  let voteRepository: VoteRepository;
  let transactionRepository: TransactionRepository;
  let controller: PostController;

  before(async () => {
    ({
      userRepository,
      postRepository,
      peopleRepository,
      commentRepository,
      voteRepository,
      transactionRepository,
      postService,
    } = await givenRepositories(testdb));
  });

  before(givenRedditService);

  before(async () => {
    socialMediaService = new SocialMediaService(
      peopleRepository,
      twitterService,
      redditService,
      facebookService,
    );
    controller = new PostController(socialMediaService, postService);
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes User in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const post = await givenPostInstance(postRepository, {createdBy: user.id});
    const response = await controller.getTimeline({include: ['user']});

    expect(response).to.containDeep([
      {
        ...post,
        user: user,
      },
    ]);
  });

  it('includes People in find method result', async () => {
    const people = await givenPeopleInstance(peopleRepository);
    const post = await givenPostInstance(postRepository, {peopleId: people.id});

    const response = await controller.getTimeline({include: ['people']});

    expect(response).to.containDeep([
      {
        ...post,
        people: people,
      },
    ]);
  });

  it('includes Comment in find method result', async () => {
    const post = await givenPostInstance(postRepository);
    const comment = await givenCommentInstance(commentRepository, {
      type: ReferenceType.POST,
      referenceId: post.id,
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      postId: post.id,
    });

    const response = await controller.getTimeline({include: ['comments']});

    expect(response).to.containDeep([
      {
        ...post,
        comments: [comment],
      },
    ]);
  });

  it('includes Vote in find method result', async () => {
    const post = await givenPostInstance(postRepository);
    const vote = await givenVoteInstance(voteRepository, {
      referenceId: post.id,
      postId: post.id,
      type: ReferenceType.POST,
    });

    const response = await controller.getTimeline({include: ['votes']});

    expect(response).to.containDeep([
      {
        ...post,
        votes: [vote],
      },
    ]);
  });

  it('includes Transaction in find method result', async () => {
    const post = await givenPostInstance(postRepository);
    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: post.id,
      type: ReferenceType.POST,
    });

    const response = await controller.getTimeline({include: ['transactions']});

    expect(response).to.containDeep([
      {
        ...post,
        transactions: [transaction],
      },
    ]);
  });

  it('includes User, People, Comment, votes, and Transaction in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const people = await givenPeopleInstance(peopleRepository);
    const post = await givenPostInstance(postRepository, {
      peopleId: people.id,
      createdBy: user.id,
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: post.id,
      type: ReferenceType.POST,
    });
    const vote = await givenVoteInstance(voteRepository, {
      referenceId: post.id,
      type: ReferenceType.POST,
      postId: post.id,
    });
    const comment = await givenCommentInstance(commentRepository, {
      type: ReferenceType.POST,
      referenceId: post.id,
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      postId: post.id,
    });

    const response = await controller.getTimeline({
      include: ['user', 'people', 'comments', 'votes', 'transactions'],
    });

    expect(response).to.containDeep([
      {
        ...post,
        user: user,
        people: people,
        votes: [vote],
        transactions: [transaction],
        comments: [comment],
      },
    ]);
  });

  it('includes User in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const post = await givenPostInstance(postRepository, {createdBy: user.id});
    const response = await controller.findById(post.id, {include: ['user']});

    expect(response).to.containDeep({
      ...post,
      user: user,
    });
  });

  it('includes People in findById method result', async () => {
    const people = await givenPeopleInstance(peopleRepository);
    const post = await givenPostInstance(postRepository, {peopleId: people.id});

    const response = await controller.findById(post.id, {include: ['people']});

    expect(response).to.containDeep({
      ...post,
      people: people,
    });
  });

  it('includes Comment in findById method result', async () => {
    const post = await givenPostInstance(postRepository);
    const comment = await givenCommentInstance(commentRepository, {
      type: ReferenceType.POST,
      referenceId: post.id,
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      postId: post.id,
    });

    const response = await controller.findById(post.id, {
      include: ['comments'],
    });

    expect(response).to.containDeep({
      ...post,
      comments: [comment],
    });
  });

  it('includes Vote in findById method result', async () => {
    const post = await givenPostInstance(postRepository);
    const vote = await givenVoteInstance(voteRepository, {
      referenceId: post.id,
      type: ReferenceType.POST,
      postId: post.id,
    });

    const response = await controller.findById(post.id, {include: ['votes']});

    expect(response).to.containDeep({
      ...post,
      votes: [vote],
    });
  });

  it('includes Transaction in findById method result', async () => {
    const post = await givenPostInstance(postRepository);
    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: post.id,
      type: ReferenceType.POST,
    });

    const response = await controller.findById(post.id, {
      include: ['transactions'],
    });

    expect(response).to.containDeep({
      ...post,
      transactions: [transaction],
    });
  });

  it('includes User, People, Comment, votes, and Transaction in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const people = await givenPeopleInstance(peopleRepository);
    const post = await givenPostInstance(postRepository, {
      peopleId: people.id,
      createdBy: user.id,
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: post.id,
      type: ReferenceType.POST,
    });
    const vote = await givenVoteInstance(voteRepository, {
      referenceId: post.id,
      type: ReferenceType.POST,
      postId: post.id,
    });
    const comment = await givenCommentInstance(commentRepository, {
      type: ReferenceType.POST,
      referenceId: post.id,
      userId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      postId: post.id,
    });

    const response = await controller.findById(post.id, {
      include: ['user', 'people', 'comments', 'votes', 'transactions'],
    });

    expect(response).to.containDeep({
      ...post,
      user: user,
      people: people,
      votes: [vote],
      transactions: [transaction],
      comments: [comment],
    });
  });

  /* eslint-disable  @typescript-eslint/no-invalid-this */
  /* eslint-disable  @typescript-eslint/no-explicit-any */
  it('imports a Post from reddit social media', async function () {
    this.timeout(15000);
    const redditPost: any = await socialMediaService.fetchRedditPost('p7qrle');
    redditPost.originCreatedAt = new Date(redditPost.originCreatedAt);
    const platformPost = givenPlatformPost();
    const urlUtils = new UrlUtils(platformPost.url);
    const platform = urlUtils.getPlatform();
    const originPostId = urlUtils.getOriginPostId();
    const username = urlUtils.getUsername();

    platformPost.url = [platform, originPostId, username].join(',');

    const response: any = await controller.import(platformPost);

    expect(toJSON(response.people)).to.containEql(
      toJSON(redditPost.platformUser),
    );

    delete response.people;
    delete redditPost.platformUser;

    expect(toJSON(response)).to.containEql(toJSON(redditPost));
  });

  async function givenRedditService() {
    const dataSource = new RedditDataSource();
    redditService = await new RedditProvider(dataSource).value();
  }
});

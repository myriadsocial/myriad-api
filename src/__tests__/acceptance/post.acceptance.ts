import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {PlatformType, ReferenceType} from '../../enums';
import {
  CreateImportedPostDto,
  DraftPost,
  Post,
  PostWithRelations,
  User,
  UserWithRelations,
} from '../../models';
import {
  CommentRepository,
  VoteRepository,
  PeopleRepository,
  PostRepository,
  TransactionRepository,
  UserRepository,
  ActivityLogRepository,
} from '../../repositories';
import {
  givenCommentInstance,
  givenCommentRepository,
  givenVoteInstance,
  givenVoteRepository,
  givenMyriadPost,
  givenMyriadPostInstance,
  givenPeopleInstance,
  givenPeopleRepository,
  givenPlatformPost,
  givenPost,
  givenPostInstance,
  givenPostRepository,
  givenTransactionInstance,
  givenTransactionRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
  givenActivityLogRepository,
  deleteAllRepository,
  givenAccesToken,
} from '../helpers';
import {AnyObject, EntityNotFoundError} from '@loopback/repository';
import {omit} from 'lodash';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('PostApplication', function () {
  this.timeout(100000);

  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let postRepository: PostRepository;
  let userRepository: UserRepository;
  let voteRepository: VoteRepository;
  let peopleRepository: PeopleRepository;
  let transactionRepository: TransactionRepository;
  let commentRepository: CommentRepository;
  let activityLogRepository: ActivityLogRepository;
  let user: User;

  before(async () => {
    ({app, client} = await setupApplication(true));
  });

  after(() => app.stop());

  before(async () => {
    postRepository = await givenPostRepository(app);
    userRepository = await givenUserRepository(app);
    voteRepository = await givenVoteRepository(app);
    peopleRepository = await givenPeopleRepository(app);
    transactionRepository = await givenTransactionRepository(app);
    commentRepository = await givenCommentRepository(app);
    activityLogRepository = await givenActivityLogRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository, {fullAccess: true});
    token = await givenAccesToken(user);
  });

  after(async () => {
    await deleteAllRepository(app);
  });

  beforeEach(async () => {
    await postRepository.deleteAll();
    await activityLogRepository.deleteAll();
  });

  it('creates a post', async () => {
    const myriadPost: Partial<DraftPost> = givenPost({
      createdBy: user.id.toString(),
    });
    const response = await client
      .post('/user/posts')
      .set('Authorization', `Bearer ${token}`)
      .send(myriadPost)
      .expect(200);
    delete myriadPost.status;
    expect(response.body).to.containDeep(myriadPost);
    const result = await postRepository.findById(response.body.id);
    expect(result).to.containDeep(myriadPost);
  });

  context('when dealing with a single persisted post', () => {
    let persistedPost: PostWithRelations;

    beforeEach(async () => {
      persistedPost = await givenMyriadPostInstance(postRepository, {
        createdBy: user.id,
        platform: PlatformType.MYRIAD,
      });
    });

    it('gets a post by ID', async () => {
      const result = await client
        .get(`/user/posts/${persistedPost.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);

      result.body.user.metric.totalPosts = 0;
      persistedPost.user = user as UserWithRelations;

      const expected = {
        ...toJSON(persistedPost),
        totalExperience: 0,
        banned: false,
      };

      expect(result.body).to.deepEqual(expected);
    });

    it('returns 404 when getting a post that does not exist', () => {
      return client
        .get('/user/posts/99999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('updates the post by ID ', async () => {
      const updatedPost: Partial<Post> = givenMyriadPost({
        platform: PlatformType.MYRIAD,
        text: 'Hello world',
      });

      delete updatedPost.createdBy;
      delete updatedPost.id;

      await client
        .patch(`/user/posts/${persistedPost.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedPost)
        .expect(200);

      const result = await postRepository.findById(persistedPost.id);
      expect(result).to.containEql(updatedPost);
    });

    it('deletes the post', async () => {
      await client
        .del(`/user/posts/${persistedPost.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      await expect(
        postRepository.findById(persistedPost.id),
      ).to.be.rejectedWith(EntityNotFoundError);
    });

    it('returns 401 when deletes the comment not belong to user', async () => {
      const post = await givenPostInstance(postRepository);
      await client
        .del(`/user/posts/${post.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(401);
    });

    it('returns 404 when deleting a comment that does not exist', async () => {
      await client
        .del(`/user/posts/99999`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  context('when dealing with multiple persisted posts', () => {
    let persistedPosts: Post[];

    beforeEach(async () => {
      persistedPosts = [
        await givenMyriadPostInstance(postRepository, {
          createdBy: user.id,
          platform: PlatformType.MYRIAD,
        }),
        await givenMyriadPostInstance(postRepository, {
          platform: PlatformType.MYRIAD,
          text: 'hello',
          createdBy: user.id,
        }),
      ];
    });

    it('finds all posts', async () => {
      const posts = toJSON(
        persistedPosts.map(e => omit(e, ['selectedUserIds', 'popularCount'])),
      );
      const response = await client
        .get('/user/posts?userId=' + user.id)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      expect(response.body.data).to.containDeep(posts);
    });

    it('exploded filter conditions work', async () => {
      await givenMyriadPostInstance(postRepository, {
        text: 'this is it',
        createdBy: user.id,
      });

      const response = await client
        .get('/user/posts?userId=' + user.id)
        .set('Authorization', `Bearer ${token}`)
        .query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });

  it('includes user, people, comments, votes, and transactions in query result', async () => {
    const people = await givenPeopleInstance(peopleRepository);
    const post = await givenPostInstance(postRepository, {
      peopleId: people.id,
      createdBy: user.id,
    });

    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: post.id,
      type: ReferenceType.POST,
      from: user.id,
      currencyId: '1',
    });
    const vote = await givenVoteInstance(voteRepository, {
      referenceId: post.id,
      postId: post.id,
      userId: user.id,
    });
    const comment = await givenCommentInstance(commentRepository, {
      type: ReferenceType.POST,
      referenceId: post.id,
      userId: user.id,
      postId: post.id,
    });

    const response = await client
      .get('/user/posts')
      .set('Authorization', `Bearer ${token}`)
      .query({
        filter: {
          include: ['user', 'people', 'comments', 'votes', 'transactions'],
        },
      });

    response.body.data[0].user.metric.totalPosts = 0;
    response.body.data[0].importers[0].metric.totalPosts = 0;

    user.metric.totalFriends = 0;
    user.metric.totalPosts = 0;

    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0]).to.deepEqual({
      ...toJSON(omit(post as Post, ['selectedUserIds', 'popularCount'])),
      banned: false,
      totalImporter: 1,
      totalExperience: 0,
      user: toJSON(user),
      people: toJSON(people),
      comments: [toJSON(comment)],
      votes: [toJSON(vote)],
      transactions: [toJSON(transaction)],
      importers: [
        {
          ...toJSON(user),
          name: 'You',
        },
      ],
    });
  });

  describe('when dealing with imported post', function () {
    beforeEach(async () => {
      await postRepository.deleteAll();
    });

    it('creates a post from reddit', async () => {
      const platformPost = givenPlatformPost({importer: user.id});
      const response = await client
        .post('/user/posts/import')
        .set('Authorization', `Bearer ${token}`)
        .send(platformPost)
        .expect(200);

      const result: AnyObject = await postRepository.findById(
        response.body.id,
        {
          include: ['people'],
        },
      );

      result.originCreatedAt = response.body.originCreatedAt;
      result.createdAt = response.body.createdAt;
      result.updatedAt = response.body.updatedAt;

      result.totalImporter = 1;
      response.body.importers[0].metric.totalPosts = 0;
      response.body.importers[0].metric.totalFriends = 1;

      expect(
        toJSON({
          ...result,
          people: {
            ...result.people,
            userSocialMedia: null,
          },
          text: result.text,
          title: result.title,
          importers: [
            Object.assign(user, {
              name: 'You',
              metric: Object.assign(user.metric, {
                totalFriends: 1,
                totalComments: 1,
                totalTransactions: 1,
              }),
            }),
          ],
        }),
      ).to.containDeep(toJSON(response.body));
    });

    it('rejects request to create a post from social media if importer alreay imported', async () => {
      const platformPost: Partial<CreateImportedPostDto> = givenPlatformPost();

      await client
        .post('/user/posts/import')
        .set('Authorization', `Bearer ${token}`)
        .send(platformPost)
        .expect(200);
      await client
        .post('/user/posts/import')
        .set('Authorization', `Bearer ${token}`)
        .send(platformPost)
        .expect(409);
    });
  });
});

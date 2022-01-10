import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {ReferenceType} from '../../enums';
import {
  Credential,
  DraftPost,
  Post,
  PostWithRelations,
  User,
} from '../../models';
import {PlatformPost} from '../../models/platform-post.model';
import {
  CommentRepository,
  VoteRepository,
  PeopleRepository,
  PostRepository,
  TagRepository,
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
  givenTagRepository,
  givenTransactionInstance,
  givenTransactionRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
  givenActivityLogRepository,
  givenAddress,
} from '../helpers';
import {u8aToHex, numberToHex} from '@polkadot/util';
import {KeyringPair} from '@polkadot/keyring/types';
import {EntityNotFoundError} from '@loopback/repository';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('PostApplication', function () {
  this.timeout(100000);

  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let postRepository: PostRepository;
  let userRepository: UserRepository;
  let tagRepository: TagRepository;
  let voteRepository: VoteRepository;
  let peopleRepository: PeopleRepository;
  let transactionRepository: TransactionRepository;
  let commentRepository: CommentRepository;
  let activityLogRepository: ActivityLogRepository;
  let user: User;
  let nonce: number;
  let address: KeyringPair;

  before(async () => {
    ({app, client} = await setupApplication(true));
  });

  after(() => app.stop());

  before(async () => {
    postRepository = await givenPostRepository(app);
    userRepository = await givenUserRepository(app);
    tagRepository = await givenTagRepository(app);
    voteRepository = await givenVoteRepository(app);
    peopleRepository = await givenPeopleRepository(app);
    transactionRepository = await givenTransactionRepository(app);
    commentRepository = await givenCommentRepository(app);
    activityLogRepository = await givenActivityLogRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    address = givenAddress();
  });

  after(async () => {
    await userRepository.deleteAll();
    await tagRepository.deleteAll();
    await voteRepository.deleteAll();
    await peopleRepository.deleteAll();
    await transactionRepository.deleteAll();
    await commentRepository.deleteAll();
    await activityLogRepository.deleteAll();
  });

  beforeEach(async () => {
    await postRepository.deleteAll();
    await activityLogRepository.deleteAll();
  });

  it('gets user nonce', async () => {
    const response = await client.get(`/users/${user.id}/nonce`).expect(200);

    nonce = response.body.nonce;
  });

  it('user login successfully', async () => {
    const credential: Credential = new Credential({
      nonce: nonce,
      publicAddress: user.id,
      signature: u8aToHex(address.sign(numberToHex(nonce))),
    });

    const res = await client.post('/login').send(credential).expect(200);
    token = res.body.accessToken;
  });

  it('creates a post', async () => {
    const myriadPost: Partial<DraftPost> = givenPost({createdBy: user.id});
    const response = await client
      .post('/posts')
      .set('Authorization', `Bearer ${token}`)
      .send(myriadPost)
      .expect(200);
    delete myriadPost.status;
    expect(response.body).to.containDeep(myriadPost);
    const result = await postRepository.findById(response.body.id);
    expect(result).to.containDeep(myriadPost);
  });

  it('returns 401 when creating a post not as login user', async () => {
    const myriadPost: Partial<DraftPost> = givenPost();

    await client
      .post('/posts')
      .set('Authorization', `Bearer ${token}`)
      .send(myriadPost)
      .expect(401);
  });

  it('rejects requests to create a post with no createdBy', async () => {
    const myriadPost: Partial<Post> = givenPost();
    delete myriadPost.createdBy;

    await client
      .post('/posts')
      .set('Authorization', `Bearer ${token}`)
      .send(myriadPost)
      .expect(422);
  });

  context('when dealing with a single persisted post', () => {
    let persistedPost: PostWithRelations;

    beforeEach(async () => {
      persistedPost = await givenMyriadPostInstance(postRepository, {
        createdBy: user.id,
      });
    });

    it('gets a post by ID', async () => {
      const result = await client
        .get(`/posts/${persistedPost.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);

      persistedPost.user = user;
      persistedPost.user.metric = {
        totalPosts: 1,
        totalExperiences: 0,
        totalFriends: 0,
        totalKudos: 0,
      };
      const expected = toJSON(persistedPost);

      expect(result.body).to.deepEqual(expected);
    });

    it('returns 404 when getting a post that does not exist', () => {
      return client
        .get('/posts/99999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('updates the post by ID ', async () => {
      const updatedPost: Partial<Post> = givenMyriadPost({
        text: 'Hello world',
      });

      delete updatedPost.createdBy;

      await client
        .patch(`/posts/${persistedPost.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedPost)
        .expect(204);

      const result = await postRepository.findById(persistedPost.id);
      expect(result).to.containEql(updatedPost);
    });

    it('returns 401 when updating the post by ID not as login user ', async () => {
      const newPost = await givenMyriadPostInstance(postRepository);
      const updatedPost: Partial<Post> = givenMyriadPost({
        text: 'Hello world',
      });

      delete updatedPost.createdBy;

      await client
        .patch(`/posts/${newPost.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedPost)
        .expect(401);
    });

    it('returns 404 when updating a post that does not exist', () => {
      const updatedPost: Partial<Post> = givenMyriadPost({
        text: 'Hello world',
      });

      delete updatedPost.createdBy;

      return client
        .patch('/posts/99999')
        .set('Authorization', `Bearer ${token}`)
        .send(updatedPost)
        .expect(404);
    });

    it('deletes the post', async () => {
      await client
        .del(`/posts/${persistedPost.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(204);
      await expect(
        postRepository.findById(persistedPost.id),
      ).to.be.rejectedWith(EntityNotFoundError);
    });

    it('returns 401 when deletes the comment not belong to user', async () => {
      const post = await givenPostInstance(postRepository);
      await client
        .del(`/posts/${post.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(401);
    });

    it('returns 404 when deleting a comment that does not exist', async () => {
      await client
        .del(`/posts/99999`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  context('when dealing with multiple persisted posts', () => {
    let persistedPosts: Post[];

    beforeEach(async () => {
      persistedPosts = [
        await givenMyriadPostInstance(postRepository, {createdBy: user.id}),
        await givenMyriadPostInstance(postRepository, {
          text: 'hello',
          createdBy: user.id,
        }),
      ];
    });

    it('finds all posts', async () => {
      const response = await client
        .get('/posts?userId=' + user.id)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      expect(response.body.data).to.containDeep(toJSON(persistedPosts));
    });

    it('queries posts with a filter', async () => {
      const postInProgress = await givenMyriadPostInstance(postRepository, {
        text: "what's up, docs!",
        createdBy: user.id,
      });

      await client
        .get('/posts?userId=' + user.id)
        .set('Authorization', `Bearer ${token}`)
        .query('filter=' + JSON.stringify({where: {text: "what's up, docs!"}}))
        .expect(200, {
          data: [toJSON(postInProgress)],
          meta: {
            currentPage: 1,
            itemsPerPage: 1,
            totalItemCount: 1,
            totalPageCount: 1,
          },
        });
    });

    it('exploded filter conditions work', async () => {
      await givenMyriadPostInstance(postRepository, {
        text: 'this is it',
        createdBy: user.id,
      });

      const response = await client
        .get('/posts?userId=' + user.id)
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
      .get('/posts?userId=' + user.id)
      .set('Authorization', `Bearer ${token}`)
      .query({
        filter: {
          include: ['user', 'people', 'comments', 'votes', 'transactions'],
        },
      });

    user.metric = {
      totalPosts: 1,
      totalExperiences: 0,
      totalFriends: 0,
      totalKudos: 0,
    };

    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0]).to.deepEqual({
      ...toJSON(post as Post),
      totalImporter: 1,
      popularCount: 0,
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
    let peopleId: string;

    beforeEach(async () => {
      await postRepository.deleteAll();

      user.metric = {
        totalPosts: 0,
        totalExperiences: 0,
        totalFriends: 0,
        totalKudos: 0,
      };
    });

    it('creates a post from reddit', async () => {
      const platformPost = givenPlatformPost({importer: user.id});
      const response = await client
        .post('/posts/import')
        .set('Authorization', `Bearer ${token}`)
        .send(platformPost)
        .expect(200);

      const result = await postRepository.findById(response.body.id, {
        include: ['people'],
      });

      peopleId = response.body.peopleId;
      result.totalImporter = 1;

      expect(
        toJSON({
          ...result,
          importers: [Object.assign(user, {name: 'You'})],
        }),
      ).to.containDeep(toJSON(response.body));
    });

    it('returns 401 when creating a post from reddit not as login user', async function () {
      const platformPost = givenPlatformPost();
      await client
        .post('/posts/import')
        .set('Authorization', `Bearer ${token}`)
        .send(platformPost)
        .expect(401);
    });

    it('creates people when creates a post from social media', async () => {
      const response = await client
        .get(`/people/${peopleId}`)
        .set('Authorization', `Bearer ${token}`);
      const result = await peopleRepository.findById(peopleId);
      expect(toJSON(result)).to.containDeep(toJSON(response.body));
    });

    it('rejects request to create a post from social media if importer alreay imported', async () => {
      const platformPost: Partial<PlatformPost> = givenPlatformPost({
        importer: user.id,
      });
      await client
        .post('/posts/import')
        .set('Authorization', `Bearer ${token}`)
        .send(platformPost)
        .expect(200);
      await client
        .post('/posts/import')
        .set('Authorization', `Bearer ${token}`)
        .send(platformPost)
        .expect(422);
    });

    it('rejects requests to create a post from social media if no url and no importer', async () => {
      const platformPost: Partial<PlatformPost> = givenPlatformPost();
      const url = platformPost.url;
      delete platformPost.url;

      await client
        .post('/posts/import')
        .set('Authorization', `Bearer ${token}`)
        .send(platformPost)
        .expect(422);

      delete platformPost.importer;
      platformPost.url = url;

      await client
        .post('/posts/import')
        .set('Authorization', `Bearer ${token}`)
        .send(platformPost)
        .expect(422);
    });
  });
});

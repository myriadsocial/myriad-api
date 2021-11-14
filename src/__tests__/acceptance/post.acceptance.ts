import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {ReferenceType} from '../../enums';
import {Post, User} from '../../models';
import {PlatformPost} from '../../models/platform-post.model';
import {
  CommentRepository,
  VoteRepository,
  PeopleRepository,
  PostRepository,
  TagRepository,
  TransactionRepository,
  UserRepository,
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
} from '../helpers';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('PostApplication', function () {
  this.timeout(20000);

  let app: MyriadApiApplication;
  let client: Client;
  let postRepository: PostRepository;
  let userRepository: UserRepository;
  let tagRepository: TagRepository;
  let voteRepository: VoteRepository;
  let peopleRepository: PeopleRepository;
  let transactionRepository: TransactionRepository;
  let commentRepository: CommentRepository;
  let user: User;

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
  });

  before(async () => {
    user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed14ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61859',
    });
  });

  after(async () => {
    await userRepository.deleteAll();
    await tagRepository.deleteAll();
    await voteRepository.deleteAll();
    await peopleRepository.deleteAll();
    await transactionRepository.deleteAll();
    await commentRepository.deleteAll();
  });

  beforeEach(async () => {
    await postRepository.deleteAll();
  });

  it('creates a post', async () => {
    const myriadPost: Partial<Post> = givenMyriadPost({createdBy: user.id});
    delete myriadPost.platform;
    const response = await client.post('/posts').send(myriadPost).expect(200);
    expect(response.body).to.containDeep(myriadPost);
    const result = await postRepository.findById(response.body.id);
    expect(result).to.containDeep(myriadPost);
  });

  it('rejects requests to create a post with no text', async () => {
    const myriadPost: Partial<Post> = givenPost();
    delete myriadPost.text;

    await client.post('/posts').send(myriadPost).expect(422);
  });

  it('rejects requests to create a post with no createdBy', async () => {
    const myriadPost: Partial<Post> = givenPost();
    delete myriadPost.createdBy;

    await client.post('/posts').send(myriadPost).expect(422);
  });

  context('when dealing with a single persisted post', () => {
    let persistedPost: Post;

    beforeEach(async () => {
      persistedPost = await givenMyriadPostInstance(postRepository, {
        createdBy: user.id,
      });
    });

    it('gets a post by ID', async () => {
      const result = await client
        .get(`/posts/${persistedPost.id}`)
        .send()
        .expect(200);
      const expected = toJSON(persistedPost);

      expect(result.body).to.deepEqual(expected);
    });

    it('returns 404 when getting a post that does not exist', () => {
      return client.get('/posts/99999').expect(404);
    });

    it('updates the post by ID ', async () => {
      const updatedPost = givenMyriadPost({
        text: 'Hello world',
      });
      await client
        .patch(`/posts/${persistedPost.id}`)
        .send(updatedPost)
        .expect(204);
      const result = await postRepository.findById(persistedPost.id);
      expect(result).to.containEql(updatedPost);
    });

    it('returns 404 when updating a post that does not exist', () => {
      return client.patch('/posts/99999').send(givenMyriadPost()).expect(404);
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
      const response = await client.get('/posts').send().expect(200);
      expect(response.body.data).to.containDeep(toJSON(persistedPosts));
    });

    it('queries posts with a filter', async () => {
      const postInProgress = await givenMyriadPostInstance(postRepository, {
        text: "what's up, docs!",
        createdBy: user.id,
      });

      await client
        .get('/posts')
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

      const response = await client.get('/posts').query('pageLimit=2');
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
    });
    const vote = await givenVoteInstance(voteRepository, {
      referenceId: post.id,
      postId: post.id,
    });
    const comment = await givenCommentInstance(commentRepository, {
      type: ReferenceType.POST,
      referenceId: post.id,
      userId: user.id,
      postId: post.id,
    });

    const response = await client.get('/posts').query({
      filter: {
        include: ['user', 'people', 'comments', 'votes', 'transactions'],
      },
    });

    expect(response.body.data).to.have.length(1);
    expect(response.body.data[0]).to.deepEqual({
      ...toJSON(post as Post),
      user: toJSON(user),
      people: toJSON(people),
      comments: [toJSON(comment)],
      votes: [toJSON(vote)],
      transactions: [toJSON(transaction)],
    });
  });

  describe('when dealing with imported post', function () {
    let peopleId: string;

    beforeEach(async () => {
      await postRepository.deleteAll();
      await userRepository.deleteAll();
    });

    it('creates a post from reddit', async function () {
      await givenUserInstance(userRepository, {
        id: '0x06fc711c1a49ad61d7b615d085723aa7d429b621d324a5513b6e54aea442d94e',
      });

      const platformPost = givenPlatformPost();
      const response = await client
        .post('/posts/import')
        .send(platformPost)
        .expect(200);
      const result = await postRepository.findById(response.body.id, {
        include: ['people', 'importers'],
      });
      expect(toJSON(result)).to.containDeep(toJSON(response.body));

      peopleId = response.body.peopleId;
    });

    it('creates people when creates a post from social media', async () => {
      const response = await client.get(`/people/${peopleId}`);
      const result = await peopleRepository.findById(peopleId);
      expect(toJSON(result)).to.containDeep(toJSON(response.body));
    });

    it('adds another importer for existing posts', async () => {
      await givenUserInstance(userRepository, {
        id: '0x06fc711c1a49ad61d7b615d085723aa7d429b621d324a5513b6e54aea442d95e',
      });
      await givenUserInstance(userRepository, {
        id: '0x06fc711c1a49ad61d7b615d085723aa7d429b621d324a5513b6e54aea442d98e',
      });

      const platformPost = givenPlatformPost({
        importer:
          '0x06fc711c1a49ad61d7b615d085723aa7d429b621d324a5513b6e54aea442d95e',
      });
      const platformPostWithOtherImporter = givenPlatformPost({
        importer:
          '0x06fc711c1a49ad61d7b615d085723aa7d429b621d324a5513b6e54aea442d98e',
      });

      const response = await client
        .post('/posts/import')
        .send(platformPost)
        .expect(200);
      const otherResponse = await client
        .post('/posts/import')
        .send(platformPostWithOtherImporter)
        .expect(200);
      expect(response.body.id).to.equal(otherResponse.body.id);
      const result = await postRepository.findById(otherResponse.body.id, {
        include: ['people', 'importers'],
      });
      expect(toJSON(result)).to.containDeep(toJSON(otherResponse.body));
    });

    it('rejects request to create a post from social media if importer alreay imported', async () => {
      await givenUserInstance(userRepository, {
        id: '0x06fc711c1a49ad61d7b615d085723aa7d429b621d324a5513b6e54aea442d98e',
      });
      const platformPost: Partial<PlatformPost> = givenPlatformPost({
        importer:
          '0x06fc711c1a49ad61d7b615d085723aa7d429b621d324a5513b6e54aea442d98e',
      });
      await client.post('/posts/import').send(platformPost).expect(200);
      await client.post('/posts/import').send(platformPost).expect(422);
    });

    it('rejects requests to create a post from social media if no url and no importer', async () => {
      const platformPost: Partial<PlatformPost> = givenPlatformPost();
      const url = platformPost.url;
      delete platformPost.url;

      await client.post('/posts/import').send(platformPost).expect(422);

      delete platformPost.importer;
      platformPost.url = url;

      await client.post('/posts/import').send(platformPost).expect(422);
    });
  });
});

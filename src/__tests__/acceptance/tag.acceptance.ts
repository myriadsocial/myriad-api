import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {Tag, User} from '../../models';
import {
  TagRepository,
  UserRepository,
  WalletRepository,
} from '../../repositories';
import {
  deleteAllRepository,
  givenAccesToken,
  givenMultipleTagInstances,
  givenTag,
  givenTagInstance,
  givenTagRepository,
  givenUserInstance,
  givenUserRepository,
  givenWalletInstance,
  givenWalletRepository,
  setupApplication,
} from '../helpers';

describe('TagApplication', function () {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let tagRepository: TagRepository;
  let userRepository: UserRepository;
  let walletRepository: WalletRepository;
  let user: User;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    tagRepository = await givenTagRepository(app);
    userRepository = await givenUserRepository(app);
    walletRepository = await givenWalletRepository(app);
  });

  beforeEach(async () => {
    await tagRepository.deleteAll();
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    token = await givenAccesToken(user);

    await givenWalletInstance(walletRepository, {userId: user.id});
  });

  after(async () => {
    await deleteAllRepository(app);
  });

  it('creates a tag', async function () {
    const tag: Partial<Tag> = givenTag();
    delete tag.count;
    const response = await client
      .post('/tags')
      .set('Authorization', `Bearer ${token}`)
      .send(tag)
      .expect(200);
    expect(response.body).to.containDeep(tag);
    const result = await tagRepository.findById(response.body.id);
    expect(result).to.containDeep(tag);
  });

  it('rejects requests to create a tag with no id', async () => {
    const tag: Partial<Tag> = givenTag();
    delete tag.id;
    delete tag.count;
    await client
      .post('/tags')
      .set('Authorization', `Bearer ${token}`)
      .send(tag)
      .expect(422);
  });

  context('when dealing with a single persisted tag', () => {
    let persistedTag: Tag;

    beforeEach(async () => {
      persistedTag = await givenTagInstance(tagRepository, {id: 'world'});
    });

    it('gets a tag by ID', async () => {
      const result = await client
        .get(`/tags/${persistedTag.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      const expected = toJSON(persistedTag);

      expect(result.body).to.deepEqual(expected);
    });

    it('returns 404 when getting a tag that does not exist', () => {
      return client
        .get('/tags/99999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  context('when dealing with multiple persisted tags', () => {
    let persistedTags: Tag[];

    beforeEach(async () => {
      persistedTags = await givenMultipleTagInstances(tagRepository);
    });

    it('finds all tags', async () => {
      const response = await client
        .get('/tags')
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      expect(response.body.data).to.containDeep(toJSON(persistedTags));
    });

    it('queries tags with a filter', async () => {
      const tagInProgress = await givenTagInstance(tagRepository, {
        id: 'technology',
        count: 1,
      });

      await client
        .get('/tags')
        .set('Authorization', `Bearer ${token}`)
        .query('filter=' + JSON.stringify({where: {id: 'technology'}}))
        .expect(200, {
          data: [toJSON(tagInProgress)],
          meta: {
            currentPage: 1,
            itemsPerPage: 1,
            totalItemCount: 1,
            totalPageCount: 1,
          },
        });
    });

    it('exploded filter conditions work', async () => {
      await givenTagInstance(tagRepository, {
        id: 'etherium',
        count: 1,
      });

      const response = await client
        .get('/tags')
        .set('Authorization', `Bearer ${token}`)
        .query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });
});

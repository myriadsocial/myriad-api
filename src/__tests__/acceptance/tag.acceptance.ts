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

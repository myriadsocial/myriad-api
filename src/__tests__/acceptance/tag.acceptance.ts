import {EntityNotFoundError} from '@loopback/repository';
import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {Tag} from '../../models';
import {TagRepository} from '../../repositories';
import {
  givenMultipleTagInstances,
  givenTag,
  givenTagInstance,
  givenTagRepository,
  setupApplication,
} from '../helpers';

describe('TagApplication', function () {
  let app: MyriadApiApplication;
  let client: Client;
  let tagRepository: TagRepository;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    tagRepository = await givenTagRepository(app);
  });

  beforeEach(async () => {
    await tagRepository.deleteAll();
  });

  it('creates a tag', async function () {
    const tag: Partial<Tag> = givenTag();
    delete tag.count;
    const response = await client.post('/tags').send(tag);
    expect(response.body).to.containDeep(tag);
    const result = await tagRepository.findById(response.body.id);
    expect(result).to.containDeep(tag);
  });

  it('rejects requests to create a tag with no id', async () => {
    const tag: Partial<Tag> = givenTag();
    delete tag.id;
    delete tag.count;
    await client.post('/tags').send(tag).expect(422);
  });

  context('when dealing with a single persisted tag', () => {
    let persistedTag: Tag;

    beforeEach(async () => {
      persistedTag = await givenTagInstance(tagRepository, {id: 'world'});
    });

    it('gets a tag by ID', async () => {
      const result = await client.get(`/tags/${persistedTag.id}`).send().expect(200);
      const expected = toJSON(persistedTag);

      expect(result.body).to.deepEqual(expected);
    });

    it('returns 404 when getting a tag that does not exist', () => {
      return client.get('/tags/99999').expect(404);
    });

    it('deletes the tag', async () => {
      await client.del(`/tags/${persistedTag.id}`).send().expect(204);
      await expect(tagRepository.findById(persistedTag.id)).to.be.rejectedWith(EntityNotFoundError);
    });

    it('returns 404 when deleting a tag that does not exist', async () => {
      await client.del(`/tags/99999`).expect(404);
    });
  });

  context('when dealing with multiple persisted tags', () => {
    let persistedTags: Tag[];

    beforeEach(async () => {
      persistedTags = await givenMultipleTagInstances(tagRepository);
    });

    it('finds all tags', async () => {
      const response = await client.get('/tags').send().expect(200);
      expect(response.body.data).to.containDeep(toJSON(persistedTags));
    });

    it('queries tags with a filter', async () => {
      const tagInProgress = await givenTagInstance(tagRepository, {
        id: 'technology',
        count: 1,
      });

      await client
        .get('/tags')
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

      const response = await client.get('/tags').query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });
});

import {
  createStubInstance,
  expect,
  sinon,
  StubbedInstanceWithSinonAccessor,
  toJSON,
} from '@loopback/testlab';
import {TagController} from '../../controllers';
import {Tag} from '../../models';
import {TagRepository} from '../../repositories';
import {givenTag} from '../helpers';

describe('TagController', () => {
  let tagRepository: StubbedInstanceWithSinonAccessor<TagRepository>;
  let controller: TagController;
  let aTag: Tag;
  let aTagWithId: Tag;
  let aListOfTags: Tag[];

  beforeEach(resetRepositories);

  describe('createTag', () => {
    it('creates a Tag', async () => {
      const create = tagRepository.stubs.create;
      create.resolves(aTagWithId);
      const result = await controller.create(aTag);
      expect(result).to.eql(aTagWithId);
      sinon.assert.calledWith(create, aTag);
    });
  });

  describe('findTagById', () => {
    it('returns a tag if it exists', async () => {
      const findById = tagRepository.stubs.findById;
      findById.resolves(aTagWithId);
      expect(await controller.findById(aTagWithId.id as string)).to.eql(
        aTagWithId,
      );
      sinon.assert.calledWith(findById, aTagWithId.id);
    });
  });

  describe('findTags', () => {
    it('returns multiple tags if they exist', async () => {
      const find = tagRepository.stubs.find;
      find.resolves(aListOfTags);
      expect(await controller.find()).to.eql(aListOfTags);
      sinon.assert.called(find);
    });

    it('returns empty list if no tags exist', async () => {
      const find = tagRepository.stubs.find;
      const expected: Tag[] = [];
      find.resolves(expected);
      expect(await controller.find()).to.eql(expected);
      sinon.assert.called(find);
    });

    it('uses the provided filter', async () => {
      const find = tagRepository.stubs.find;
      const filter = toJSON({where: {id: 'hello'}});

      find.resolves(aListOfTags);
      await controller.find(filter);
      sinon.assert.calledWith(find, filter);
    });
  });

  function resetRepositories() {
    tagRepository = createStubInstance(TagRepository);
    aTag = givenTag();
    aTagWithId = givenTag({
      id: 'hello',
    });
    aListOfTags = [
      aTagWithId,
      givenTag({
        id: 'world',
        count: 1,
      }),
    ] as Tag[];

    controller = new TagController(tagRepository);
  }
});

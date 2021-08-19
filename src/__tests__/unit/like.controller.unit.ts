import {createStubInstance, sinon, StubbedInstanceWithSinonAccessor} from '@loopback/testlab';
import {LikeController} from '../../controllers';
import {Like} from '../../models';
import {LikeRepository} from '../../repositories';
import {givenLike} from '../helpers';

describe('LikeController', () => {
  let likeRepository: StubbedInstanceWithSinonAccessor<LikeRepository>;
  let controller: LikeController;
  let aLikeWithId: Like;

  beforeEach(resetRepositories);

  describe('deleteLike', () => {
    it('successfully deletes existing items', async () => {
      const deleteById = likeRepository.stubs.deleteById;
      deleteById.resolves();
      await controller.deleteById(aLikeWithId.id as string);
      sinon.assert.calledWith(deleteById, aLikeWithId.id);
    });
  });

  function resetRepositories() {
    likeRepository = createStubInstance(LikeRepository);

    aLikeWithId = givenLike({
      id: '1',
    });

    controller = new LikeController(likeRepository);
  }
});

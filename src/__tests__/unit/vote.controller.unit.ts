import {
  createStubInstance,
  sinon,
  StubbedInstanceWithSinonAccessor,
} from '@loopback/testlab';
import {VoteController} from '../../controllers';
import {Vote} from '../../models';
import {VoteRepository} from '../../repositories';
import {NotificationService} from '../../services';
import {givenVote} from '../helpers';

describe('VoteController', () => {
  let voteRepository: StubbedInstanceWithSinonAccessor<VoteRepository>;
  let notificationService: NotificationService;
  let controller: VoteController;
  let aVoteWithId: Vote;

  beforeEach(resetRepositories);

  describe('deleteVote', () => {
    it('successfully deletes existing items', async () => {
      const deleteById = voteRepository.stubs.deleteById;
      deleteById.resolves();
      await controller.deleteById(aVoteWithId.id as string);
      sinon.assert.calledWith(deleteById, aVoteWithId.id);
    });
  });

  function resetRepositories() {
    voteRepository = createStubInstance(VoteRepository);

    aVoteWithId = givenVote({
      id: '1',
    });

    controller = new VoteController(voteRepository, notificationService);
  }
});

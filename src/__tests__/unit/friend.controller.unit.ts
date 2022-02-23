import {
  createStubInstance,
  expect,
  sinon,
  StubbedInstanceWithSinonAccessor,
  toJSON,
} from '@loopback/testlab';
import {FriendController} from '../../controllers';
import {FriendStatusType} from '../../enums';
import {Friend} from '../../models';
import {FriendRepository} from '../../repositories';
import {givenFriend} from '../helpers';

describe('FriendControllers', () => {
  let friendRepository: StubbedInstanceWithSinonAccessor<FriendRepository>;
  let controller: FriendController;
  let aFriend: Friend;
  let aFriendWithId: Friend;
  let aListOfFriends: Friend[];

  beforeEach(resetRepositories);

  describe('createFriend', () => {
    it('creates a Friend', async () => {
      const create = friendRepository.stubs.create;
      create.resolves(aFriendWithId);
      const result = await controller.create(aFriend);
      expect(result).to.eql(aFriendWithId);
      sinon.assert.calledWith(create, aFriend);
    });
  });

  describe('findFriendById', () => {
    it('returns a friend if it exists', async () => {
      const findById = friendRepository.stubs.findById;
      findById.resolves(aFriendWithId);
      expect(await controller.findById(aFriendWithId.id as string)).to.eql(
        aFriendWithId,
      );
      sinon.assert.calledWith(findById, aFriendWithId.id);
    });
  });

  describe('findFriends', () => {
    it('returns multiple friends if they exist', async () => {
      const find = friendRepository.stubs.find;
      find.resolves(aListOfFriends);
      expect(await controller.find()).to.eql(aListOfFriends);
      sinon.assert.called(find);
    });

    it('returns empty list if no friends exist', async () => {
      const find = friendRepository.stubs.find;
      const expected: Friend[] = [];
      find.resolves(expected);
      expect(await controller.find()).to.eql(expected);
      sinon.assert.called(find);
    });

    it('uses the provided filter', async () => {
      const find = friendRepository.stubs.find;
      const filter = toJSON({where: {status: FriendStatusType.PENDING}});

      find.resolves(aListOfFriends);
      await controller.find(filter);
      sinon.assert.calledWith(find, filter);
    });
  });

  function resetRepositories() {
    friendRepository = createStubInstance(FriendRepository);

    aFriend = givenFriend();
    aFriendWithId = givenFriend({
      id: '1',
    });
    aListOfFriends = [
      aFriendWithId,
      givenFriend({
        status: FriendStatusType.APPROVED,
      }),
    ] as Friend[];

    controller = new FriendController(friendRepository);
  }
});

import {
  createStubInstance,
  expect,
  sinon,
  StubbedInstanceWithSinonAccessor,
  toJSON,
} from '@loopback/testlab';
import {FriendController} from '../../controllers';
import {FriendStatusType} from '../../enums';
import {CustomFilter, Friend} from '../../models';
import {FriendRepository, UserRepository} from '../../repositories';
import {FriendService, NotificationService} from '../../services';
import {givenFriend} from '../helpers';

describe('FriendController', () => {
  let friendRepository: StubbedInstanceWithSinonAccessor<FriendRepository>;
  let userRepository: UserRepository;
  let friendService: FriendService;
  let notificationService: NotificationService;
  let controller: FriendController;
  let aFriend: Friend;
  let aFriendWithId: Friend;
  let aChangedFriend: Friend;
  let aListOfFriends: Friend[];

  beforeEach(resetRepositories);

  describe('createFriend', () => {
    it('creates a Friend', async () => {
      const create = friendRepository.stubs.create;
      create.resolves(aFriendWithId);
      const result = await controller.add(aFriend);
      expect(result).to.eql(aFriendWithId);
      sinon.assert.calledWith(create, aFriend);
    });
  });

  describe('findFriendById', () => {
    it('returns a friend if it exists', async () => {
      const findById = friendRepository.stubs.findById;
      findById.resolves(aFriendWithId);
      expect(await controller.findById(aFriendWithId.id as string)).to.eql(aFriendWithId);
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
      await controller.find(filter as CustomFilter);
      sinon.assert.calledWith(find, filter);
    });
  });

  describe('updateFriend', () => {
    it('successfully updates existing items', async () => {
      const updateById = friendRepository.stubs.updateById;
      updateById.resolves();
      await controller.updateById(aFriendWithId.id as string, aChangedFriend);
      sinon.assert.calledWith(updateById, aFriendWithId.id, aChangedFriend);
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
    aChangedFriend = givenFriend({
      status: FriendStatusType.APPROVED,
    });

    friendService = new FriendService(friendRepository, userRepository, notificationService);
    controller = new FriendController(notificationService, friendService);
  }
});

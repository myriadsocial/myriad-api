import {
  createStubInstance,
  expect,
  sinon,
  StubbedInstanceWithSinonAccessor,
  toJSON,
} from '@loopback/testlab';
import {PeopleController} from '../../controllers';
import {PlatformType} from '../../enums';
import {People} from '../../models';
import {
  FriendRepository,
  PeopleRepository,
  UserRepository,
} from '../../repositories';
import {givenPeople} from '../helpers';
import {securityId} from '@loopback/security';

describe('PeopleController', () => {
  let peopleRepository: StubbedInstanceWithSinonAccessor<PeopleRepository>;
  let userRepository: StubbedInstanceWithSinonAccessor<UserRepository>;
  let friendRepository: StubbedInstanceWithSinonAccessor<FriendRepository>;
  let controller: PeopleController;
  let aPeopleWithId: People;
  let aListOfPeople: People[];

  beforeEach(resetRepositories);

  describe('findPeopleById', () => {
    it('returns a people if it exists', async () => {
      const findById = peopleRepository.stubs.findById;
      findById.resolves(aPeopleWithId);
      expect(await controller.findById(aPeopleWithId.id as string)).to.eql(
        aPeopleWithId,
      );
      sinon.assert.calledWith(findById, aPeopleWithId.id);
    });
  });

  describe('findPeople', () => {
    it('returns multiple people if they exist', async () => {
      const find = peopleRepository.stubs.find;
      find.resolves(aListOfPeople);
      expect(await controller.find()).to.eql(aListOfPeople);
      sinon.assert.called(find);
    });

    it('returns empty list if no people exist', async () => {
      const find = peopleRepository.stubs.find;
      const expected: People[] = [];
      find.resolves(expected);
      expect(await controller.find()).to.eql(expected);
      sinon.assert.called(find);
    });

    it('uses the provided filter', async () => {
      const find = peopleRepository.stubs.find;
      const filter = toJSON({where: {username: 'elonmusk'}});

      find.resolves(aListOfPeople);
      await controller.find(filter);
      sinon.assert.calledWith(find, filter);
    });
  });

  describe('deletePeople', () => {
    it('successfully deletes existing items', async () => {
      const deleteById = peopleRepository.stubs.deleteById;
      deleteById.resolves();
      await controller.deleteById(aPeopleWithId.id as string);
      sinon.assert.calledWith(deleteById, aPeopleWithId.id);
    });
  });

  function resetRepositories() {
    peopleRepository = createStubInstance(PeopleRepository);
    userRepository = createStubInstance(UserRepository);
    friendRepository = createStubInstance(FriendRepository);
    aPeopleWithId = givenPeople({
      id: '1',
    });
    aListOfPeople = [
      aPeopleWithId,
      givenPeople({
        id: '2',
        name: 'Gavin Wood',
        username: 'gavofyork',
        platform: PlatformType.TWITTER,
        originUserId: '33962758',
        profilePictureURL:
          'https://pbs.twimg.com/profile_images/981390758870683656/RxA_8cyN_400x400.jpg',
      }),
    ] as People[];

    controller = new PeopleController(
      peopleRepository,
      userRepository,
      friendRepository,
      {[securityId]: ''},
    );
  }
});

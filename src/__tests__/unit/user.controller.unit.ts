import {
  createStubInstance,
  expect,
  sinon,
  StubbedInstanceWithSinonAccessor,
  toJSON,
} from '@loopback/testlab';
import {UserController} from '../../controllers/user.controller';
import {User, UserWithRelations} from '../../models';
import {UserRepository} from '../../repositories';
import {givenUser} from '../helpers';

describe('UserControllers', () => {
  let userRepository: StubbedInstanceWithSinonAccessor<UserRepository>;
  let controller: UserController;
  let aUserWithId: UserWithRelations;
  let aChangedUser: User;
  let aListOfUsers: UserWithRelations[];

  beforeEach(resetRepositories);

  describe('findUserById', () => {
    it('returns a user if it exists', async () => {
      const findById = userRepository.stubs.findById;
      findById.resolves(aUserWithId);
      expect(await controller.findById(aUserWithId.id as string)).to.eql(
        aUserWithId,
      );
      sinon.assert.calledWith(findById, aUserWithId.id);
    });
  });

  describe('findUsers', () => {
    it('returns multiple users if they exist', async () => {
      const find = userRepository.stubs.find;
      find.resolves(aListOfUsers);
      expect(await controller.find()).to.eql(aListOfUsers);
      sinon.assert.called(find);
    });

    it('returns empty list if no users exist', async () => {
      const find = userRepository.stubs.find;
      const expected: UserWithRelations[] = [];
      find.resolves(expected);
      expect(await controller.find()).to.eql(expected);
      sinon.assert.called(find);
    });

    it('uses the provided filter', async () => {
      const find = userRepository.stubs.find;
      const filter = toJSON({where: {name: 'hakim'}});

      find.resolves(aListOfUsers);
      await controller.find(filter);
      sinon.assert.calledWith(find, filter);
    });
  });

  describe('updateUser', () => {
    it('successfully updates existing items', async () => {
      const updateById = userRepository.stubs.updateById;
      updateById.resolves();
      await controller.updateById(aUserWithId.id as string, aChangedUser);
      sinon.assert.calledWith(updateById, aUserWithId.id, aChangedUser);
    });
  });

  function resetRepositories() {
    userRepository = createStubInstance(UserRepository);
    aUserWithId = givenUser({
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61859',
    }) as UserWithRelations;
    aListOfUsers = [
      aUserWithId,
      givenUser({
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61861',
        name: 'husni',
        username: 'husni',
        bio: 'Hello, my name is husni!',
      }),
    ] as UserWithRelations[];
    aChangedUser = givenUser({
      id: aUserWithId.id,
      name: 'irman',
      bio: 'Hello, my name is irman!',
    });

    controller = new UserController(userRepository);
  }
});

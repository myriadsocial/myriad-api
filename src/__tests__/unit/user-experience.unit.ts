import {
  createStubInstance,
  expect,
  sinon,
  StubbedInstanceWithSinonAccessor,
  toJSON,
} from '@loopback/testlab';
import {UserExperienceController} from '../../controllers/user-experience.controller';
import {UserExperience} from '../../models';
import {
  ExperienceRepository,
  UserExperienceRepository,
  UserRepository,
} from '../../repositories';
import {givenUserExperience} from '../helpers';

describe('UserExperienceController', () => {
  let userRepository: StubbedInstanceWithSinonAccessor<UserRepository>;
  let experienceRepository: StubbedInstanceWithSinonAccessor<ExperienceRepository>;
  let userExperienceRepository: StubbedInstanceWithSinonAccessor<UserExperienceRepository>;
  let controller: UserExperienceController;
  let aUserExperienceWithId: UserExperience;
  let aListOfUserExperiences: UserExperience[];

  beforeEach(resetRepositories);

  describe('findUserExperienceById', () => {
    it('returns a userExperience if it exists', async () => {
      const findById = userExperienceRepository.stubs.findById;
      findById.resolves(aUserExperienceWithId);
      expect(
        await controller.findById(aUserExperienceWithId.id as string),
      ).to.eql(aUserExperienceWithId);
      sinon.assert.calledWith(findById, aUserExperienceWithId.id);
    });
  });

  describe('findUserExperiences', () => {
    it('returns multiple users if they exist', async () => {
      const find = userExperienceRepository.stubs.find;
      find.resolves(aListOfUserExperiences);
      expect(await controller.find()).to.eql(aListOfUserExperiences);
      sinon.assert.called(find);
    });

    it('returns empty list if no userExperiences exist', async () => {
      const find = userExperienceRepository.stubs.find;
      const expected: UserExperience[] = [];
      find.resolves(expected);
      expect(await controller.find()).to.eql(expected);
      sinon.assert.called(find);
    });

    it('uses the provided filter', async () => {
      const find = userExperienceRepository.stubs.find;
      const filter = toJSON({where: {name: 'hakim'}});

      find.resolves(aListOfUserExperiences);
      await controller.find(filter);
      sinon.assert.calledWith(find, filter);
    });
  });

  describe('deleteUserExperience', () => {
    it('successfully deletes existing items', async () => {
      const deleteById = userExperienceRepository.stubs.deleteById;
      deleteById.resolves();
      await controller.deleteById(aUserExperienceWithId.id as string);
      sinon.assert.calledWith(deleteById, aUserExperienceWithId.id);
    });
  });

  function resetRepositories() {
    userRepository = createStubInstance(UserRepository);
    userExperienceRepository = createStubInstance(UserExperienceRepository);
    experienceRepository = createStubInstance(ExperienceRepository);
    aUserExperienceWithId = givenUserExperience({id: '1'});
    aListOfUserExperiences = [
      aUserExperienceWithId,
      givenUserExperience({
        subscribed: false,
        experienceId: '2',
        userId:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61823',
      }),
    ] as UserExperience[];

    controller = new UserExperienceController(
      userRepository,
      userExperienceRepository,
      experienceRepository,
    );
  }
});

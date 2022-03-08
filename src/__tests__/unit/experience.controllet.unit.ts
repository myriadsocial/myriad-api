import {
  createStubInstance,
  expect,
  sinon,
  StubbedInstanceWithSinonAccessor,
  toJSON,
} from '@loopback/testlab';
import {ExperienceController} from '../../controllers';
import {PlatformType} from '../../enums';
import {Experience, People} from '../../models';
import {ExperienceRepository} from '../../repositories';
import {givenExperience} from '../helpers';

describe('ExperienceController', () => {
  let experienceRepository: StubbedInstanceWithSinonAccessor<ExperienceRepository>;
  let controller: ExperienceController;
  let aExperienceWithId: Experience;
  let aListOfExperiences: Experience[];

  beforeEach(resetRepositories);

  describe('findExperiencerById', () => {
    it('returns a experience if it exists', async () => {
      const findById = experienceRepository.stubs.findById;
      findById.resolves(aExperienceWithId);
      expect(await controller.findById(aExperienceWithId.id as string)).to.eql(
        aExperienceWithId,
      );
      sinon.assert.calledWith(findById, aExperienceWithId.id);
    });
  });

  describe('findExperiences', () => {
    it('returns multiple experiences if they exist', async () => {
      const find = experienceRepository.stubs.find;
      find.resolves(aListOfExperiences);
      expect(await controller.find()).to.eql(aListOfExperiences);
      sinon.assert.called(find);
    });

    it('returns empty list if no experiences exist', async () => {
      const find = experienceRepository.stubs.find;
      const expected: Experience[] = [];
      find.resolves(expected);
      expect(await controller.find()).to.eql(expected);
      sinon.assert.called(find);
    });

    it('uses the provided filter', async () => {
      const find = experienceRepository.stubs.find;
      const filter = toJSON({where: {name: 'hakim'}});

      find.resolves(aListOfExperiences);
      await controller.find(filter);
      sinon.assert.calledWith(find, filter);
    });
  });

  function resetRepositories() {
    experienceRepository = createStubInstance(ExperienceRepository);
    aExperienceWithId = givenExperience({
      id: '1',
    });
    aListOfExperiences = [
      aExperienceWithId,
      givenExperience({
        name: 'my crypto',
        allowedTags: ['cryptocurrency'],
        people: [
          new People({
            id: '60efac8c565ab8004ed28ba7',
            name: 'Gavin Wood',
            username: 'gavofyork',
            platform: PlatformType.TWITTER,
            originUserId: '33962758',
            profilePictureURL:
              'https://pbs.twimg.com/profile_images/981390758870683656/RxA_8cyN_400x400.jpg',
          }),
        ],
        description: 'cryptoverse',
        createdBy:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee6182e',
      }),
    ] as Experience[];

    controller = new ExperienceController(experienceRepository);
  }
});

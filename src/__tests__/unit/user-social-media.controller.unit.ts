import {
  createStubInstance,
  expect,
  sinon,
  StubbedInstanceWithSinonAccessor,
  toJSON,
} from '@loopback/testlab';
import {UserSocialMediaController} from '../../controllers';
import {PlatformType} from '../../enums';
import {UserSocialMedia} from '../../models';
import {PeopleRepository, UserSocialMediaRepository} from '../../repositories';
import {
  ActivityLogService,
  NotificationService,
  SocialMediaService,
  UserSocialMediaService,
} from '../../services';
import {givenUserSocialMedia} from '../helpers';
import {securityId} from '@loopback/security';

describe('UserSocialMediaController', () => {
  let userSocialMediaRepository: StubbedInstanceWithSinonAccessor<UserSocialMediaRepository>;
  let socialMediaService: SocialMediaService;
  let notificationService: NotificationService;
  let userSocialMediaService: UserSocialMediaService;
  let activityLogService: ActivityLogService;
  let peopleRepository: PeopleRepository;
  let controller: UserSocialMediaController;
  let aUserSocialMediaWithId: UserSocialMedia;
  let aListOfUserSocialMedias: UserSocialMedia[];

  beforeEach(resetRepositories);

  describe('findUserSocialMediaById', () => {
    it('returns a user social media if it exists', async () => {
      const findById = userSocialMediaRepository.stubs.findById;
      findById.resolves(aUserSocialMediaWithId);
      expect(
        await controller.findById(aUserSocialMediaWithId.id as string),
      ).to.eql(aUserSocialMediaWithId);
      sinon.assert.calledWith(findById, aUserSocialMediaWithId.id);
    });
  });

  describe('findUserSocialMedias', () => {
    it('returns multiple userSocialMedias if they exist', async () => {
      const find = userSocialMediaRepository.stubs.find;
      find.resolves(aListOfUserSocialMedias);
      expect(await controller.find()).to.eql(aListOfUserSocialMedias);
      sinon.assert.called(find);
    });

    it('returns empty list if no userSocialMedias exist', async () => {
      const find = userSocialMediaRepository.stubs.find;
      const expected: UserSocialMedia[] = [];
      find.resolves(expected);
      expect(await controller.find()).to.eql(expected);
      sinon.assert.called(find);
    });

    it('uses the provided filter', async () => {
      const find = userSocialMediaRepository.stubs.find;
      const filter = toJSON({where: {name: 'hakim'}});

      find.resolves(aListOfUserSocialMedias);
      await controller.find(filter);
      sinon.assert.calledWith(find, filter);
    });
  });

  describe('deleteUserSocialMediaById', () => {
    it('successfully deletes existing items', async () => {
      const deleteById = userSocialMediaRepository.stubs.deleteById;
      deleteById.resolves();
      await controller.deleteById(aUserSocialMediaWithId.id as string);
      sinon.assert.calledWith(deleteById, aUserSocialMediaWithId.id);
    });
  });

  function resetRepositories() {
    userSocialMediaRepository = createStubInstance(UserSocialMediaRepository);
    aUserSocialMediaWithId = givenUserSocialMedia({
      id: '1',
    });
    aListOfUserSocialMedias = [
      aUserSocialMediaWithId,
      givenUserSocialMedia({
        verified: true,
        platform: PlatformType.FACEBOOK,
        userId:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61864',
        peopleId: '2',
      }),
    ] as UserSocialMedia[];

    userSocialMediaService = new UserSocialMediaService(
      userSocialMediaRepository,
      peopleRepository,
      notificationService,
      activityLogService,
      {[securityId]: ''},
    );
    controller = new UserSocialMediaController(
      socialMediaService,
      userSocialMediaService,
      notificationService,
    );
  }
});

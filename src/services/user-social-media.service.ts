import {repository} from '@loopback/repository';
import {ActivityLogType, PlatformType, ReferenceType} from '../enums';
import {People, UserSocialMedia} from '../models';
import {PeopleRepository, UserSocialMediaRepository} from '../repositories';
import {injectable, BindingScope, service, inject} from '@loopback/core';
import {NotificationService} from './';
import {HttpErrors} from '@loopback/rest';
import {config} from '../config';
import {BcryptHasher} from './authentication/hash.password.service';
import {ActivityLogService} from './activity-log.service';
import {AuthenticationBindings} from '@loopback/authentication';
import {UserProfile, securityId} from '@loopback/security';

@injectable({scope: BindingScope.TRANSIENT})
export class UserSocialMediaService {
  constructor(
    @repository(UserSocialMediaRepository)
    public userSocialMediaRepository: UserSocialMediaRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @service(NotificationService)
    protected notificationService: NotificationService,
    @service(ActivityLogService)
    protected activityLogService: ActivityLogService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    protected currentUser: UserProfile,
  ) {}

  async createSocialMedia(people: People): Promise<UserSocialMedia> {
    const {name, originUserId, username, platform, profilePictureURL} = people;

    const newUserSocialMedia: Partial<UserSocialMedia> = {
      userId: this.currentUser[securityId],
      platform: platform as PlatformType,
      verified: true,
    };

    let foundPeople = await this.peopleRepository.findOne({
      where: {
        originUserId: originUserId,
        platform: platform,
      },
    });

    if (!foundPeople) {
      foundPeople = await this.peopleRepository.create({
        name,
        username,
        originUserId,
        platform,
        profilePictureURL,
      });

      const hasher = new BcryptHasher();
      const hashPeopleId = await hasher.hashPassword(
        foundPeople.id + config.MYRIAD_ESCROW_SECRET_KEY,
      );
      await this.peopleRepository.updateById(foundPeople.id, {
        walletAddressPassword: hashPeopleId,
      });
    } else {
      await this.peopleRepository.updateById(foundPeople.id, {
        name,
        username,
        profilePictureURL,
      });
    }

    const userSocialMedia = await this.userSocialMediaRepository.findOne({
      where: {
        peopleId: foundPeople.id,
        platform: platform as PlatformType,
      },
    });

    if (userSocialMedia) {
      if (userSocialMedia.userId !== this.currentUser[securityId]) {
        try {
          await this.notificationService.sendDisconnectedSocialMedia(
            userSocialMedia.id,
            this.currentUser[securityId],
          );
        } catch {
          // ignore
        }
        await this.userSocialMediaRepository.deleteById(userSocialMedia.id);
      } else {
        throw new HttpErrors.UnprocessableEntity(
          `You already claimed this ${platform}`,
        );
      }
    }

    const {count} = await this.userSocialMediaRepository.count({
      userId: this.currentUser[securityId],
      platform: platform as PlatformType,
    });

    if (count === 0) newUserSocialMedia.primary = true;

    await this.activityLogService.createLog(
      ActivityLogType.CLAIMSOCIAL,
      foundPeople.id,
      ReferenceType.PEOPLE,
    );

    return this.peopleRepository
      .userSocialMedia(foundPeople.id)
      .create(newUserSocialMedia);
  }
}

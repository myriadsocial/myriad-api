import {AnyObject, repository} from '@loopback/repository';
import {ActivityLogType, PlatformType, ReferenceType} from '../enums';
import {People, UserSocialMedia} from '../models';
import {PeopleRepository, UserSocialMediaRepository} from '../repositories';
import {injectable, BindingScope, service, inject} from '@loopback/core';
import {NotificationService} from './';
import {ActivityLogService} from './activity-log.service';
import {AuthenticationBindings} from '@loopback/authentication';
import {UserProfile, securityId} from '@loopback/security';
import {generateObjectId} from '../utils/formatted';
import {omit} from 'lodash';

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

    const existPeople = await this.peopleRepository.findOne({
      where: {originUserId, platform},
    });

    const peopleId = generateObjectId();
    const found = existPeople ?? new People({...people, id: peopleId});
    const userSocialMedia = await this.userSocialMediaRepository.findOne({
      where: {
        peopleId: found.id,
        platform: platform as PlatformType,
      },
    });

    Object.assign(found, {name, username, profilePictureURL});

    Promise.allSettled([
      found.id === peopleId
        ? this.peopleRepository.create(found)
        : this.peopleRepository.updateById(found.id, omit(found, ['id'])),
    ]) as Promise<AnyObject>;

    if (userSocialMedia) {
      const verified = userSocialMedia.userId === this.currentUser[securityId];
      if (verified) return Object.assign(userSocialMedia, {connected: true});

      Promise.allSettled([
        this.notificationService.sendDisconnectedSocialMedia(
          userSocialMedia.id,
          this.currentUser[securityId],
        ),
        this.userSocialMediaRepository.deleteById(userSocialMedia.id),
      ]) as Promise<AnyObject>;
    }

    const {count} = await this.userSocialMediaRepository.count({
      userId: this.currentUser[securityId],
      platform: platform as PlatformType,
    });

    if (count === 0) newUserSocialMedia.primary = true;

    this.activityLogService.createLog(
      ActivityLogType.CLAIMSOCIAL,
      found.id,
      ReferenceType.PEOPLE,
    ) as Promise<void>;

    return this.peopleRepository
      .userSocialMedia(found.id)
      .create(newUserSocialMedia);
  }
}

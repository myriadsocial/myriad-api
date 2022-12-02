import {AuthenticationBindings} from '@loopback/authentication';
import {BindingScope, inject, injectable, service} from '@loopback/core';
import {AnyObject, Filter, repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {omit} from 'lodash';
import {ActivityLogType, PlatformType, ReferenceType} from '../enums';
import {
  People,
  SocialMediaVerificationDto,
  UserSocialMedia,
  UserSocialMediaWithRelations,
} from '../models';
import {
  IdentityRepository,
  PeopleRepository,
  UserSocialMediaRepository,
} from '../repositories';
import {generateObjectId} from '../utils/formatter';
import {NotificationService} from './notification.service';
import {ActivityLogService} from './activity-log.service';
import {MetricService} from './metric.service';
import {SocialMediaService} from './social-media/social-media.service';

@injectable({scope: BindingScope.TRANSIENT})
export class UserSocialMediaService {
  constructor(
    @repository(IdentityRepository)
    private identityRepository: IdentityRepository,
    @repository(UserSocialMediaRepository)
    private userSocialMediaRepository: UserSocialMediaRepository,
    @repository(PeopleRepository)
    private peopleRepository: PeopleRepository,
    @service(ActivityLogService)
    private activityLogService: ActivityLogService,
    @service(MetricService)
    private metricService: MetricService,
    @service(NotificationService)
    private notificationService: NotificationService,
    @service(SocialMediaService)
    private socialMediaService: SocialMediaService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private currentUser: UserProfile,
  ) {}

  public async find(
    filter?: Filter<UserSocialMedia>,
  ): Promise<UserSocialMedia[]> {
    return this.userSocialMediaRepository.find(filter);
  }

  public async patch(id: string): Promise<void> {
    await this.userSocialMediaRepository
      .findById(id)
      .then(async ({platform}) => {
        await Promise.allSettled([
          this.userSocialMediaRepository.updateAll(
            {primary: false},
            {userId: this.currentUser[securityId], platform},
          ),
          this.userSocialMediaRepository.updateAll(
            {primary: true, updatedAt: new Date().toString()},
            {userId: this.currentUser[securityId], id},
          ),
        ]);
      });
  }

  public async deleteById(id: string): Promise<void> {
    return this.userSocialMediaRepository
      .deleteAll({
        id,
        userId: this.currentUser[securityId],
      })
      .then(({count}) => {
        if (!count) return;
        this.notificationService.sendDisconnectedSocialMedia(
          id,
        ) as Promise<boolean>;
        return;
      });
  }

  public async create(
    data: SocialMediaVerificationDto,
  ): Promise<UserSocialMedia> {
    const people = await this.fetchPeople(data);
    const {name, originUserId, username, platform, profilePictureURL} = people;

    const newUserSocialMedia: Partial<UserSocialMedia> = {
      userId: this.currentUser[securityId],
      platform: platform as PlatformType,
      verified: true,
    };

    const exist = await this.peopleRepository.findOne({
      where: {originUserId, platform},
    });

    const peopleId = generateObjectId();
    const found = exist ?? new People({...people, id: peopleId});
    const userSocialMedia = await this.userSocialMediaRepository.findOne({
      where: {
        peopleId: found.id,
        platform: platform as PlatformType,
      },
    });

    if (!found.connectedDate) found.connectedDate = new Date().toString();

    Object.assign(found, {name, username, profilePictureURL});

    await Promise.allSettled([
      found.id === peopleId
        ? this.peopleRepository.create(found)
        : this.peopleRepository.updateById(found.id, omit(found, ['id'])),
    ]);

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

    this.activityLogService.create(
      ActivityLogType.CLAIMSOCIAL,
      found.id,
      ReferenceType.PEOPLE,
    ) as Promise<void>;

    return this.peopleRepository
      .userSocialMedia(found.id)
      .create(newUserSocialMedia)
      .then(result => this.afterCreate(result, people));
  }

  // ------------------------------------------------

  // ------ PrivateMethod ---------------------------

  /* eslint-disable @typescript-eslint/no-misused-promises */
  private async fetchPeople(
    socialMediaVerificationDto: SocialMediaVerificationDto,
    delay = 1000,
    triesLeft = 10,
  ): Promise<People> {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        if (triesLeft <= 1) {
          reject(new HttpErrors.NotFound('Cannot find specified post'));
          clearInterval(interval);
        }

        try {
          const people = await this.verify(socialMediaVerificationDto);
          resolve(people);
          clearInterval(interval);
        } catch {
          // ignore
        }

        triesLeft--;
      }, delay);
    });
  }

  private async afterCreate(
    userSocialMedia: UserSocialMediaWithRelations,
    people: People,
  ): Promise<UserSocialMedia> {
    const currentUserId = this.currentUser[securityId];
    const key = `social-media/${currentUserId}`;
    const connected = userSocialMedia?.connected;
    const promises = [
      this.metricService.countServerMetric(),
      this.identityRepository.delete(key),
    ];

    if (!connected) {
      promises.push(
        this.notificationService.sendConnectedSocialMedia(userSocialMedia),
      );
    }

    Promise.allSettled(promises) as Promise<AnyObject>;

    return Object.assign(userSocialMedia, {people});
  }

  private async verify(
    socialMediaVerificationDto: SocialMediaVerificationDto,
  ): Promise<People> {
    const {address, platform, username} = socialMediaVerificationDto;

    await this.verifyIdentity(address);

    switch (platform) {
      case PlatformType.TWITTER:
        return this.socialMediaService.verifyToTwitter(username, address);

      case PlatformType.REDDIT:
        return this.socialMediaService.verifyToReddit(username, address);

      default:
        throw new HttpErrors.NotFound('Platform does not exist');
    }
  }

  private async verifyIdentity(hash: string): Promise<void> {
    const currentUserId = this.currentUser[securityId];
    const key = `social-media/${currentUserId}`;
    const identity = await this.identityRepository.get(key);
    const now = Date.now();

    if (!identity) {
      throw new HttpErrors.UnprocessableEntity('InvalidHashCode');
    }

    if (now > identity.expiredAt) {
      throw new HttpErrors.UnprocessableEntity('HashCodeExpired');
    }

    if (identity.userId !== currentUserId) {
      throw new HttpErrors.UnprocessableEntity('InvalidUser');
    }

    if (identity.hash !== hash) {
      throw new HttpErrors.UnprocessableEntity('InvalidHashCode');
    }
  }
}

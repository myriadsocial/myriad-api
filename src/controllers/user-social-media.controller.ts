import {intercept, service} from '@loopback/core';
import {AnyObject, Filter, FilterExcludingWhere} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  HttpErrors,
  param,
  post,
  requestBody,
  response,
  patch,
} from '@loopback/rest';
import {PlatformType} from '../enums';
import {CreateInterceptor, PaginationInterceptor} from '../interceptors';
import {People, UserSocialMedia, UserVerification} from '../models';
import {
  MetricService,
  NotificationService,
  SocialMediaService,
  UserSocialMediaService,
} from '../services';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
export class UserSocialMediaController {
  constructor(
    @service(SocialMediaService)
    protected socialMediaService: SocialMediaService,
    @service(UserSocialMediaService)
    protected userSocMedService: UserSocialMediaService,
    @service(NotificationService)
    protected notificationService: NotificationService,
    @service(MetricService)
    protected metricService: MetricService,
  ) {}

  @intercept(CreateInterceptor.BINDING_KEY)
  @post('/user-social-medias/verify')
  @response(200, {
    description: 'Verify User Social Media',
    content: {
      'application/json': {
        schema: getModelSchemaRef(UserSocialMedia),
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserVerification),
        },
      },
    })
    userVerification: UserVerification,
  ): Promise<UserSocialMedia> {
    const {delay, triesLeft} = userVerification;
    const people = await this.fetchPeople(userVerification, delay, triesLeft);
    const socialMedia = await this.userSocMedService.createSocialMedia(people);
    const connected = (socialMedia as AnyObject).connected;
    const promises = [this.metricService?.countServerMetric()];

    if (!connected) {
      promises.push(
        this.notificationService.sendConnectedSocialMedia(socialMedia, people),
      );
    }

    Promise.allSettled(promises) as Promise<AnyObject>;

    return socialMedia;
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/user-social-medias')
  @response(200, {
    description: 'Array of UserSocialMedia model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(UserSocialMedia, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(UserSocialMedia, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<UserSocialMedia>,
  ): Promise<UserSocialMedia[]> {
    return this.userSocMedService.userSocialMediaRepository.find(filter);
  }

  @get('/user-social-medias/{id}')
  @response(200, {
    description: 'UserSocialMedia model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(UserSocialMedia, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(UserSocialMedia, {exclude: 'where'})
    filter?: FilterExcludingWhere<UserSocialMedia>,
  ): Promise<UserSocialMedia> {
    return this.userSocMedService.userSocialMediaRepository.findById(
      id,
      filter,
    );
  }

  @patch('/user-social-medias/{id}/primary')
  @response(204, {
    description: 'Set primary social media',
  })
  async updatePrimary(@param.path.string('id') id: string): Promise<void> {
    const {userId, platform} =
      await this.userSocMedService.userSocialMediaRepository.findById(id);

    await Promise.allSettled([
      this.userSocMedService.userSocialMediaRepository.updateAll(
        {primary: false},
        {userId, platform},
      ),
      this.userSocMedService.userSocialMediaRepository.updateById(id, {
        primary: true,
        updatedAt: new Date().toString(),
      }),
    ]);
  }

  @del('/user-social-medias/{id}')
  @response(204, {
    description: 'UserSocialMedia DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    Promise.allSettled([
      this.notificationService?.sendDisconnectedSocialMedia(id),
      this.userSocMedService.userSocialMediaRepository.deleteById(id),
      this.metricService?.countServerMetric(),
    ]) as Promise<AnyObject>;
  }

  /* eslint-disable @typescript-eslint/no-misused-promises */
  async fetchPeople(
    userVerification: UserVerification,
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
          const people = await this.verifySocialMedia(userVerification);
          resolve(people);
          clearInterval(interval);
        } catch {
          // ignore
        }

        triesLeft--;
      }, delay);
    });
  }

  async verifySocialMedia(userVerification: UserVerification): Promise<People> {
    const {address, platform, username} = userVerification;

    switch (platform) {
      case PlatformType.TWITTER:
        return this.socialMediaService.verifyToTwitter(username, address);

      case PlatformType.REDDIT:
        return this.socialMediaService.verifyToReddit(username, address);

      default:
        throw new HttpErrors.NotFound('Platform does not exist');
    }
  }
}

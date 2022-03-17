import {intercept, service} from '@loopback/core';
import {Filter, FilterExcludingWhere} from '@loopback/repository';
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
import {UserSocialMedia, UserVerification} from '../models';
import {
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
    protected userSocialMediaService: UserSocialMediaService,
    @service(NotificationService)
    protected notificationService: NotificationService,
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
    const {publicKey, platform, username} = userVerification;

    let people = null;

    switch (platform) {
      case PlatformType.TWITTER:
        people = await this.socialMediaService.verifyToTwitter(
          username,
          publicKey,
        );

        break;

      case PlatformType.REDDIT:
        people = await this.socialMediaService.verifyToReddit(
          username,
          publicKey,
        );

        break;

      default:
        throw new HttpErrors.NotFound('Platform does not exist');
    }

    const socialMedia = await this.userSocialMediaService.createSocialMedia(
      people,
    );

    await Promise.allSettled([
      this.notificationService.sendConnectedSocialMedia(socialMedia, people),
    ]);

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
    return this.userSocialMediaService.userSocialMediaRepository.find(filter);
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
    return this.userSocialMediaService.userSocialMediaRepository.findById(
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
      await this.userSocialMediaService.userSocialMediaRepository.findById(id);

    await this.userSocialMediaService.userSocialMediaRepository.updateAll(
      {primary: false},
      {userId: userId, platform},
    );

    await this.userSocialMediaService.userSocialMediaRepository.updateById(id, {
      primary: true,
      updatedAt: new Date().toString(),
    });
  }

  @del('/user-social-medias/{id}')
  @response(204, {
    description: 'UserSocialMedia DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    try {
      await this.notificationService.sendDisconnectedSocialMedia(id);
    } catch {
      // ignore
    }

    await this.userSocialMediaService.userSocialMediaRepository.deleteById(id);
  }
}

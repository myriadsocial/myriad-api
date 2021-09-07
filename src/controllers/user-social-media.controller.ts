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
} from '@loopback/rest';
import {PlatformType} from '../enums';
import {PaginationInterceptor} from '../interceptors';
import {UserSocialMedia, UserVerification} from '../models';
import {SocialMediaService, UserSocialMediaService} from '../services';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class UserSocialMediaController {
  constructor(
    @service(SocialMediaService)
    protected socialMediaService: SocialMediaService,
    @service(UserSocialMediaService)
    protected userSocialMediaService: UserSocialMediaService,
  ) {}

  @post('/user-social-medias/verify')
  @response(200, {
    description: 'Verify User Social Media',
    content: {
      'application/json': {
        schema: getModelSchemaRef(UserSocialMedia),
      },
    },
  })
  async verify(
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

    let platformUser = null;

    switch (platform) {
      case PlatformType.TWITTER:
        platformUser = await this.socialMediaService.verifyToTwitter(
          username,
          publicKey,
        );

        break;

      case PlatformType.REDDIT:
        platformUser = await this.socialMediaService.verifyToReddit(
          username,
          publicKey,
        );

        break;

      case PlatformType.FACEBOOK:
        platformUser = await this.socialMediaService.verifyToFacebook(
          username,
          publicKey,
        );

        break;

      default:
        throw new HttpErrors.NotFound('Platform does not exist');
    }

    return this.userSocialMediaService.createSocialMedia(platformUser);
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

  @del('/user-social-medias/{id}')
  @response(204, {
    description: 'UserSocialMedia DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.userSocialMediaService.userSocialMediaRepository.deleteById(id);
  }
}

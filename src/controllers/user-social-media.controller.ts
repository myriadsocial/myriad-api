import {intercept, service} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  HttpErrors,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import dotenv from 'dotenv';
import {PlatformType} from '../enums';
import {PaginationInterceptor} from '../interceptors';
import {CustomFilter, UserSocialMedia, VerifyUser} from '../models';
import {UserSocialMediaRepository} from '../repositories';
import {SocialMediaService, UserSocialMediaService} from '../services';
// import {authenticate} from '@loopback/authentication';

dotenv.config();

// @authenticate("jwt")
export class UserSocialMediaController {
  constructor(
    @repository(UserSocialMediaRepository)
    protected userSocialMediaRepository: UserSocialMediaRepository,
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
          schema: getModelSchemaRef(VerifyUser),
        },
      },
    })
    verifyUser: VerifyUser,
  ): Promise<UserSocialMedia> {
    const {publickey, platform, username} = verifyUser;

    let platformUser = null;

    switch (platform) {
      case PlatformType.TWITTER:
        platformUser = await this.socialMediaService.verifyToTwitter(username, publickey);

        break;

      case PlatformType.REDDIT:
        platformUser = await this.socialMediaService.verifyToReddit(username, publickey);

        break;

      case PlatformType.FACEBOOK:
        platformUser = await this.socialMediaService.verifyToFacebook(username, publickey);

        break;

      default:
        throw new HttpErrors.NotFound('Platform does not exist');
    }

    return this.userSocialMediaService.createSocialMedia(platformUser);

    // this.cryptocurrencyService.claimTips(userSocialMedia) as Promise<void>;
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
    @param.query.object('filter', getModelSchemaRef(CustomFilter)) filter: CustomFilter,
  ): Promise<UserSocialMedia[]> {
    return this.userSocialMediaRepository.find(filter as Filter<UserSocialMedia>);
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
    return this.userSocialMediaRepository.findById(id, filter);
  }

  @patch('/user-social-medias/{id}')
  @response(204, {
    description: 'UserSocialMedia PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserSocialMedia, {partial: true}),
        },
      },
    })
    userSocialMedia: UserSocialMedia,
  ): Promise<void> {
    await this.userSocialMediaRepository.updateById(id, userSocialMedia);
  }

  @del('/user-social-medias/{id}')
  @response(204, {
    description: 'UserSocialMedia DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.userSocialMediaRepository.deleteById(id);
  }
}

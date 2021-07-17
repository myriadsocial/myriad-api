import {service} from '@loopback/core';
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
import {UserCredential, VerifyUser} from '../models';
import {UserCredentialRepository} from '../repositories';
import {
  CryptocurrencyService,
  SocialMediaService,
  UserCredentialService,
} from '../services';
import dotenv from 'dotenv';
import {PlatformType} from '../enums';
// import {authenticate} from '@loopback/authentication';

dotenv.config();

// @authenticate("jwt")
export class UserCredentialController {
  constructor(
    @repository(UserCredentialRepository)
    protected userCredentialRepository: UserCredentialRepository,
    @service(CryptocurrencyService)
    protected cryptocurrencyService: CryptocurrencyService,
    @service(SocialMediaService)
    protected socialMediaService: SocialMediaService,
    @service(UserCredentialService)
    protected userCredentialService: UserCredentialService,
  ) {}

  @post('/user-credentials/verify')
  @response(200, {
    description: 'Verify User',
    content: {
      'application/json': {
        schema: getModelSchemaRef(UserCredential),
      },
    },
  })
  async verifyUserPlatform(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(VerifyUser),
        },
      },
    })
    verifyUser: VerifyUser,
  ): Promise<UserCredential> {
    const {publickey, platform, username} = verifyUser;

    let platformUser = null;

    // TODO: move to single constant enum platform
    // TODO: move logic to service
    switch (platform) {
      case PlatformType.TWITTER:
        platformUser = await this.socialMediaService.verifyToTwitter(
          username,
          publickey,
        ); // Fetch data user from twitter api // Add new credential

        break;

      case PlatformType.REDDIT:
        platformUser = await this.socialMediaService.verifyToReddit(
          username,
          publickey,
        );

        break;

      case PlatformType.FACEBOOK:
        platformUser = await this.socialMediaService.verifyToFacebook(
          username,
          publickey,
        );

        break;

      default:
        throw new HttpErrors.NotFound('Platform does not exist');
    }

    const userCredential = await this.userCredentialService.createCredential(
      platformUser,
    );

    this.cryptocurrencyService.claimTips(userCredential) as Promise<void>;

    return userCredential;
  }

  @get('/user-credentials')
  @response(200, {
    description: 'Array of UserCredential model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(UserCredential, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(UserCredential) filter?: Filter<UserCredential>,
  ): Promise<UserCredential[]> {
    return this.userCredentialRepository.find(filter);
  }

  @get('/user-credentials/{id}')
  @response(200, {
    description: 'UserCredential model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(UserCredential, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(UserCredential, {exclude: 'where'})
    filter?: FilterExcludingWhere<UserCredential>,
  ): Promise<UserCredential> {
    return this.userCredentialRepository.findById(id, filter);
  }

  @patch('/user-credentials/{id}')
  @response(204, {
    description: 'UserCredential PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserCredential, {partial: true}),
        },
      },
    })
    userCredential: UserCredential,
  ): Promise<void> {
    await this.userCredentialRepository.updateById(id, userCredential);
  }

  @del('/user-credentials/{id}')
  @response(204, {
    description: 'UserCredential DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.userCredentialRepository.deleteById(id);
  }

  // TODO: Move all method services
}

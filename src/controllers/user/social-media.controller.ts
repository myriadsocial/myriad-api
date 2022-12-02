import {authenticate} from '@loopback/authentication';
import {intercept, service} from '@loopback/core';
import {Filter} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {PaginationInterceptor} from '../../interceptors';
import {SocialMediaVerificationDto, UserSocialMedia} from '../../models';
import {UserService} from '../../services';

@authenticate('jwt')
export class UserSocialMediaController {
  constructor(
    @service(UserService)
    private userService: UserService,
  ) {}

  @get('/user/social-medias/identity')
  @response(200, {
    description: 'REQUEST social medias identity verification',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            hash: {
              type: 'string',
            },
          },
        },
      },
    },
  })
  async requestOTP(): Promise<{hash: string}> {
    return this.userService.requestSocialMediaIdentityCode();
  }

  @post('/user/social-medias/verify')
  @response(200, {
    description: 'VERIFY User Social Media',
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
          schema: getModelSchemaRef(SocialMediaVerificationDto),
        },
      },
    })
    data: SocialMediaVerificationDto,
  ): Promise<UserSocialMedia> {
    return this.userService.verifySocialMedia(data);
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/user/social-medias')
  @response(200, {
    description: 'GET user socialmedias',
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
    return this.userService.socialMedia(filter);
  }

  @patch('/user/social-medias/{id}/primary')
  @response(204, {
    description: 'SET primary socialmedia',
  })
  async updatePrimary(@param.path.string('id') id: string): Promise<void> {
    return this.userService.setPrimarySocialMedia(id);
  }

  @del('/user/social-medias/{id}')
  @response(204, {
    description: 'DELETE user socialmedia',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    return this.userService.removeSocialMedia(id);
  }
}

import {authenticate, AuthenticationBindings} from '@loopback/authentication';
import {inject, service} from '@loopback/core';
import {
  get,
  getModelSchemaRef,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {Transaction} from '../interfaces';
import {ClaimReference} from '../models';
import {NetworkService} from '../services';
import {UserProfile, securityId} from '@loopback/security';
import {repository} from '@loopback/repository';
import {
  TransactionRepository,
  UserSocialMediaRepository,
} from '../repositories';

@authenticate('jwt')
export class ClaimReferenceController {
  constructor(
    @repository(TransactionRepository)
    private transactionRepository: TransactionRepository,
    @repository(UserSocialMediaRepository)
    private userSocialMediaRepository: UserSocialMediaRepository,
    @service(NetworkService)
    protected networkService: NetworkService,
    @inject(AuthenticationBindings.CURRENT_USER)
    private currentUser: UserProfile,
  ) {}

  @get('/user/tip-status')
  @response(200, {
    description: 'GET user tip status',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            status: {
              type: 'boolean',
            },
          },
        },
      },
    },
  })
  async getTipStatus(): Promise<{status: boolean}> {
    if (this.currentUser?.fullAccess) return {status: false};
    if (!this.currentUser?.[securityId]) return {status: false};

    const socialMedias = await this.userSocialMediaRepository.find({
      where: {userId: this.currentUser[securityId]},
    });
    const receiverIds = socialMedias.map(e => e.peopleId);
    const receivers = await this.transactionRepository.find({
      where: {
        to: {
          inq: [...receiverIds, this.currentUser[securityId]],
        },
      },
    });

    return {status: receivers.length > 0};
  }

  @post('/claim-references')
  @response(200, {
    description: 'Claim Reference',
  })
  async claim(
    @requestBody({
      'application/json': {
        schema: getModelSchemaRef(ClaimReference),
      },
    })
    claimReference: ClaimReference,
  ): Promise<Transaction> {
    return this.networkService.claimReference(claimReference);
  }
}

import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  get,
  getModelSchemaRef,
  HttpErrors,
  param,
  response,
} from '@loopback/rest';
import {config} from '../config';
import {PlatformType} from '../enums';
import {TokenServiceBindings} from '../keys';
import {WalletAddress} from '../models';
import {PeopleRepository, PostRepository} from '../repositories';
import {JWTService} from '../services';
import {BcryptHasher} from '../services/authentication/hash.password.service';
import {PolkadotJs} from '../utils/polkadotJs-utils';
import {authenticate} from '@loopback/authentication';
import {LoggingBindings, logInvocation, WinstonLogger} from '@loopback/logging';

@authenticate('jwt')
export class PostWalletAddress {
  // Inject a winston logger
  @inject(LoggingBindings.WINSTON_LOGGER)
  private logger: WinstonLogger;

  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    protected jwtService: JWTService,
  ) {}

  @logInvocation()
  @get('/posts/{id}/walletaddress')
  @response(200, {
    description: 'Post model wallet address',
    content: {
      'application/json': {
        schema: getModelSchemaRef(WalletAddress),
      },
    },
  })
  async getWalletAddress(
    @param.path.string('id') id: string,
  ): Promise<WalletAddress> {
    const post = await this.postRepository.findById(id);

    const wallet = new WalletAddress();
    const hasher = new BcryptHasher();

    if (!post.peopleId) {
      if (post.platform === PlatformType.MYRIAD) {
        wallet.walletAddress = post.createdBy;

        return wallet;
      } else {
        throw new HttpErrors.NotFound('Walletaddress Not Found!');
      }
    }

    const people = await this.peopleRepository.findById(post.peopleId, {
      include: ['userSocialMedia'],
    });

    if (people.userSocialMedia) {
      wallet.walletAddress = people.userSocialMedia.userId;
    } else {
      if (!people.walletAddressPassword)
        throw new HttpErrors.Unauthorized('Not Authorized');

      const password = people.id + config.MYRIAD_ESCROW_SECRET_KEY;
      const match = await hasher.comparePassword(
        password,
        people.walletAddressPassword,
      );

      if (!match) throw new HttpErrors.Unauthorized('Not Authorized');

      const token = await this.jwtService.generateAnyToken({
        id: people.id,
        originUserId: people.originUserId,
        platform: people.platform,
        iat: new Date(people.createdAt ?? '').getTime(),
      });

      const {getKeyring, getHexPublicKey} = new PolkadotJs();
      const newKey = getKeyring().addFromUri('//' + token);

      wallet.walletAddress = getHexPublicKey(newKey);
    }

    return wallet;
  }
}

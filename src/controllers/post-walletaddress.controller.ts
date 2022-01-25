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
import {Wallet} from '../models';
import {PostRepository} from '../repositories';
import {JWTService} from '../services';
import {BcryptHasher} from '../services/authentication/hash.password.service';
import {PolkadotJs} from '../utils/polkadotJs-utils';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
export class PostWalletAddress {
  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    protected jwtService: JWTService,
  ) {}

  @get('/posts/{id}/walletaddress')
  @response(200, {
    description: 'Post model wallet address',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Wallet),
      },
    },
  })
  async getWalletAddress(@param.path.string('id') id: string): Promise<Wallet> {
    const post = await this.postRepository.findById(id, {
      include: [
        {
          relation: 'people',
          scope: {
            include: [{relation: 'userSocialMedia'}],
          },
        },
      ],
    });

    const hasher = new BcryptHasher();
    const people = post.people;

    if (!people) {
      if (post.platform !== PlatformType.MYRIAD) {
        throw new HttpErrors.NotFound('Walletaddress Not Found!');
      }

      return new Wallet({walletAddress: post.createdBy});
    }

    if (people.userSocialMedia) {
      const userId = people.userSocialMedia.userId;
      return new Wallet({walletAddress: userId});
    }

    if (!people.walletAddressPassword) {
      throw new HttpErrors.Unauthorized('Not Authorized');
    }

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

    return new Wallet({walletAddress: getHexPublicKey(newKey)});
  }
}

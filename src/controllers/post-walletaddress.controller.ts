import {inject} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {get, HttpErrors, param, response} from '@loopback/rest';
import {config} from '../config';
import {PlatformType} from '../enums';
import {TokenServiceBindings} from '../keys';
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
        schema: {
          type: 'object',
          properties: {
            walletAddress: {
              type: 'string',
            },
          },
        },
      },
    },
  })
  async getWalletAddress(
    @param.path.string('id') id: string,
  ): Promise<AnyObject> {
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

      return {walletAddress: post.createdBy};
    }

    if (people.userSocialMedia) {
      const userId = people.userSocialMedia.userId;
      return {walletAddress: userId};
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

    return {walletAddress: getHexPublicKey(newKey)};
  }
}

import {inject} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {get, HttpErrors, param, response} from '@loopback/rest';
import {config} from '../config';
import {PlatformType} from '../enums';
import {TokenServiceBindings} from '../keys';
import {PostRepository, WalletRepository} from '../repositories';
import {JWTService} from '../services';
import {BcryptHasher} from '../services/authentication/hash.password.service';
import {PolkadotJs} from '../utils/polkadotJs-utils';
import {authenticate, AuthenticationBindings} from '@loopback/authentication';
import {UserProfile, securityId} from '@loopback/security';

@authenticate('jwt')
export class PostWalletAddress {
  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    protected jwtService: JWTService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    protected currentUser: UserProfile,
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
    const wallet = await this.walletRepository.findOne({
      where: {
        userId: this.currentUser[securityId],
        primary: true,
      },
    });

    if (!wallet) {
      throw new HttpErrors.UnprocessableEntity('Wallet not exists');
    }

    const {type} = wallet;

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

      const toWalletPost = await this.walletRepository.findOne({
        where: {
          userId: post.createdBy,
          type: type,
        },
      });

      if (!toWalletPost) {
        if (type === 'near') {
          throw new HttpErrors.UnprocessableEntity(
            'Post near wallet not exists',
          );
        } else {
          throw new HttpErrors.UnprocessableEntity(
            'Post polkadot wallet not exists',
          );
          // TODO: Uncomment when escrow ready
          // if (network === 'myriad') {
          //   return {
          //     referenceId: post.createdBy,
          //     referenceType: 'user',
          //   };
          // } else {
          //   throw new HttpErrors.UnprocessableEntity(
          //     'Post polkadot wallet not exists',
          //   );
          // }
        }
      }

      return {
        referenceId: toWalletPost.id,
        referenceType: 'walletAddress',
      };
    }

    if (people.userSocialMedia) {
      const userId = people.userSocialMedia.userId;

      const toWalletUser = await this.walletRepository.findOne({
        where: {userId, type},
      });

      if (!toWalletUser) {
        if (type === 'near') {
          throw new HttpErrors.UnprocessableEntity(
            'Post near wallet not exists',
          );
        } else {
          throw new HttpErrors.UnprocessableEntity(
            'Post polkadot wallet not exists',
          );
          // TODO: Uncomment when escrow ready
          // if (network === 'myriad') {
          //   return {
          //     referenceId: post.createdBy,
          //     referenceType: 'user',
          //   };
          // } else {
          //   throw new HttpErrors.UnprocessableEntity(
          //     'Post polkadot wallet not exists',
          //   );
          // }
        }
      }

      return {
        referenceId: toWalletUser.id,
        referenceType: 'walletAddress',
      };
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

    return {
      referenceId: getHexPublicKey(newKey),
      referenceType: 'walletAddress',
    };
  }
}

import {inject} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {get, HttpErrors, param, response} from '@loopback/rest';
import {NetworkType, PlatformType, ReferenceType, WalletType} from '../enums';
import {PostRepository, WalletRepository} from '../repositories';
import {authenticate, AuthenticationBindings} from '@loopback/authentication';
import {UserProfile, securityId} from '@loopback/security';
import {config} from '../config';

@authenticate('jwt')
export class PostWalletAddress {
  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
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
      throw new HttpErrors.NotFound('Wallet not exists');
    }

    const {type, network} = wallet;

    const post = await this.postRepository.findById(id, {
      include: [
        {
          relation: 'people',
          scope: {
            include: ['userSocialMedia'],
          },
        },
      ],
    });

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

      if (toWalletPost) {
        return {
          referenceId: toWalletPost.id,
          referenceType: ReferenceType.WALLETADDRESS,
        };
      }

      return this.tipsBalanceInfo(
        type,
        network,
        ReferenceType.USER,
        post.createdBy,
      );
    }

    if (people.userSocialMedia) {
      const userId = people.userSocialMedia.userId;

      const toWalletUser = await this.walletRepository.findOne({
        where: {userId, type},
      });

      if (toWalletUser) {
        return {
          referenceId: toWalletUser.id,
          referenceType: ReferenceType.WALLETADDRESS,
        };
      }

      return this.tipsBalanceInfo(type, network, ReferenceType.USER, userId);
    }

    return this.tipsBalanceInfo(type, network, ReferenceType.PEOPLE, people.id);
  }

  tipsBalanceInfo(
    walletType: WalletType,
    networkType: NetworkType,
    referenceType: ReferenceType,
    referenceId: string,
  ): AnyObject {
    const tipsBalanceInfo = {
      serverId: config.MYRIAD_SERVER_ID,
      referenceType: referenceType,
      referenceId: referenceId,
    };

    switch (walletType) {
      case WalletType.NEAR:
        // TODO: implement near smartcontract
        // return tipsBalanceInfo
        throw new HttpErrors.NotFound('Post near wallet not exists');

      case WalletType.POLKADOT: {
        if (networkType === NetworkType.MYRIAD) {
          return tipsBalanceInfo;
        }

        throw new HttpErrors.NotFound('Post polkadot wallet not exists');
      }

      default:
        throw new HttpErrors.NotFound('Wallet not exists');
    }
  }
}

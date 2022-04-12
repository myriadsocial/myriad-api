import {inject} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {get, HttpErrors, param, response} from '@loopback/rest';
import {NetworkType, PlatformType, ReferenceType, WalletType} from '../enums';
import {
  CommentRepository,
  PostRepository,
  UserRepository,
  WalletRepository,
} from '../repositories';
import {authenticate, AuthenticationBindings} from '@loopback/authentication';
import {UserProfile, securityId} from '@loopback/security';
import {config} from '../config';

@authenticate('jwt')
export class WalletAddressController {
  constructor(
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
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
            serverId: {
              type: 'string',
            },
            referenceType: {
              type: 'string',
            },
            referenceId: {
              type: 'string',
            },
          },
        },
      },
    },
  })
  async getPostWalletAddress(
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

  @get('/comments/{id}/walletaddress')
  @response(200, {
    description: 'Comment model wallet address',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            serverId: {
              type: 'string',
            },
            referenceType: {
              type: 'string',
            },
            referenceId: {
              type: 'string',
            },
          },
        },
      },
    },
  })
  async getCommentWalletAddress(
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

    const comment = await this.commentRepository.findById(id, {
      include: [
        {
          relation: 'user',
          scope: {
            include: [
              {
                relation: 'wallets',
                scope: {
                  where: {
                    type: type,
                  },
                },
              },
            ],
          },
        },
      ],
    });

    const wallets = comment?.user?.wallets;

    if (!wallets || wallets.length === 0) {
      const user = comment?.user;
      if (!user) {
        throw new HttpErrors.NotFound('User not found');
      }
      return this.tipsBalanceInfo(type, network, ReferenceType.USER, user.id);
    }

    return {
      referenceId: wallets[0].id,
      referenceType: ReferenceType.WALLETADDRESS,
    };
  }

  @get('/users/{id}/walletaddress')
  @response(200, {
    description: 'Comment model wallet address',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            serverId: {
              type: 'string',
            },
            referenceType: {
              type: 'string',
            },
            referenceId: {
              type: 'string',
            },
          },
        },
      },
    },
  })
  async getUserWalletAddress(
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
    const toWalletUser = await this.walletRepository.findOne({
      where: {userId: id, type},
    });

    if (toWalletUser) {
      return {
        referenceId: toWalletUser.id,
        referenceType: ReferenceType.WALLETADDRESS,
      };
    }

    return this.tipsBalanceInfo(type, network, ReferenceType.USER, id);
  }

  tipsBalanceInfo(
    walletType: WalletType,
    networkType: string,
    referenceType: ReferenceType,
    referenceId: string,
  ): AnyObject {
    if (!config.MYRIAD_SERVER_ID) {
      throw new HttpErrors.NotFound('Not implemented');
    }
    const tipsBalanceInfo = {
      serverId: config.MYRIAD_SERVER_ID,
      referenceType: referenceType,
      referenceId: referenceId,
    };

    switch (walletType) {
      case WalletType.POLKADOT: {
        if (networkType === NetworkType.MYRIAD) {
          return tipsBalanceInfo;
        }

        throw new HttpErrors.NotFound('Polkadot wallet not exists');
      }

      case WalletType.NEAR:
        // TODO: implement near smartcontract
        // return tipsBalanceInfo
        throw new HttpErrors.NotFound('Near wallet not exists');

      default:
        throw new HttpErrors.NotFound('Wallet not exists');
    }
  }
}

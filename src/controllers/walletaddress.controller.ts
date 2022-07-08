import {inject} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {get, HttpErrors, param, response} from '@loopback/rest';
import {PlatformType, ReferenceType} from '../enums';
import {
  CommentRepository,
  NetworkRepository,
  PostRepository,
  ServerRepository,
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
    @repository(NetworkRepository)
    protected networkRepository: NetworkRepository,
    @repository(ServerRepository)
    protected serverRepository: ServerRepository,
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
    const {networkId, blockchainPlatform, networkIds} =
      await this.getCurrentUserNetwork();
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
          networkId: {inq: networkIds},
        },
      });

      if (toWalletPost) {
        return {
          referenceId: toWalletPost.id,
          referenceType: ReferenceType.WALLETADDRESS,
        };
      }

      return this.tipsBalanceInfo(
        blockchainPlatform,
        networkId,
        ReferenceType.USER,
        post.createdBy,
      );
    }

    if (people.userSocialMedia) {
      const userId = people.userSocialMedia.userId;
      const toWalletUser = await this.walletRepository.findOne({
        where: {userId, networkId: {inq: networkIds}},
      });

      if (toWalletUser) {
        return {
          referenceId: toWalletUser.id,
          referenceType: ReferenceType.WALLETADDRESS,
        };
      }

      return this.tipsBalanceInfo(
        blockchainPlatform,
        networkId,
        ReferenceType.USER,
        userId,
      );
    }

    return this.tipsBalanceInfo(
      blockchainPlatform,
      networkId,
      ReferenceType.PEOPLE,
      people.id,
    );
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
    const {networkId, blockchainPlatform, networkIds} =
      await this.getCurrentUserNetwork();
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
                    networkId: {inq: networkIds},
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
      return this.tipsBalanceInfo(
        blockchainPlatform,
        networkId,
        ReferenceType.USER,
        user.id,
      );
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
    const {networkId, blockchainPlatform, networkIds} =
      await this.getCurrentUserNetwork();
    const toWalletUser = await this.walletRepository.findOne({
      where: {userId: id, networkId: {inq: networkIds}},
    });

    if (toWalletUser) {
      return {
        referenceId: toWalletUser.id,
        referenceType: ReferenceType.WALLETADDRESS,
      };
    }

    return this.tipsBalanceInfo(
      blockchainPlatform,
      networkId,
      ReferenceType.USER,
      id,
    );
  }

  async getCurrentUserNetwork(): Promise<AnyObject> {
    const wallet = await this.walletRepository.findOne({
      where: {
        userId: this.currentUser[securityId],
        primary: true,
      },
      include: ['network'],
    });

    if (!wallet?.network) {
      throw new HttpErrors.NotFound('Wallet not exists');
    }

    const {id: networkId, blockchainPlatform} = wallet.network;
    const networks = await this.networkRepository.find({
      where: {blockchainPlatform},
    });
    const networkIds = networks.map(network => network.id);

    return {
      networkId,
      blockchainPlatform,
      networkIds,
    };
  }

  async tipsBalanceInfo(
    blockchainPlatform: string,
    networkType: string,
    referenceType: ReferenceType,
    referenceId: string,
  ): Promise<AnyObject> {
    if (!config.MYRIAD_SERVER_ID) {
      throw new HttpErrors.NotFound('Not implemented');
    }
    const myriadServerId = config.MYRIAD_SERVER_ID;
    const tipsBalanceInfo = {
      serverId: myriadServerId,
      referenceType: referenceType,
      referenceId: referenceId,
    };

    switch (blockchainPlatform) {
      case 'substrate': {
        if (networkType === 'myriad') {
          return tipsBalanceInfo;
        }

        throw new HttpErrors.NotFound('Polkadot wallet not exists');
      }

      case 'near': {
        const server = await this.serverRepository.findById(myriadServerId);
        const serverId = server.accountId?.[networkType];
        if (!serverId) throw new HttpErrors.NotFound('ServerNotFound');

        return Object.assign(tipsBalanceInfo, {serverId});
      }

      default:
        throw new HttpErrors.NotFound('Wallet not exists');
    }
  }
}

import {AuthenticationBindings} from '@loopback/authentication';
import {BindingScope, inject, injectable} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {PlatformType, ReferenceType} from '../enums';
import {
  CommentRepository,
  NetworkRepository,
  PostRepository,
  ServerRepository,
  UnlockableContentRepository,
  WalletRepository,
} from '../repositories';

interface NetworkDetail {
  networkId: string;
  networkIds: string[];
}

export interface TipsBalanceInfo {
  referenceType: string;
  referenceId: string;
  serverId?: string;
}

@injectable({scope: BindingScope.TRANSIENT})
export class WalletAddressService {
  constructor(
    @repository(CommentRepository)
    private commentRepository: CommentRepository,
    @repository(PostRepository)
    private postRepository: PostRepository,
    @repository(NetworkRepository)
    private networkRepository: NetworkRepository,
    @repository(ServerRepository)
    private serverRepository: ServerRepository,
    @repository(UnlockableContentRepository)
    private unlockableContentRepository: UnlockableContentRepository,
    @repository(WalletRepository)
    private walletRepository: WalletRepository,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private currentUser: UserProfile,
  ) {}

  public async findById(
    id: string,
    kind: ReferenceType,
  ): Promise<TipsBalanceInfo> {
    switch (kind) {
      case ReferenceType.POST:
        return this.postWalletAddress(id);

      case ReferenceType.COMMENT:
        return this.commentWalletAddress(id);

      case ReferenceType.USER:
        return this.userWalletAddress(id);

      case ReferenceType.UNLOCKABLECONTENT.replace('_', '-'):
        return this.unlockableContentWalletAddress(id);

      default:
        throw new HttpErrors.NotFound('WalletAddressNotFound');
    }
  }

  private async postWalletAddress(id: string): Promise<TipsBalanceInfo> {
    const {networkId, networkIds} = await this.currentUserNetwork();
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
        throw new HttpErrors.NotFound('WalletAddressNotFound');
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

      return this.tipsBalanceInfo(networkId, ReferenceType.USER, userId);
    }

    return this.tipsBalanceInfo(networkId, ReferenceType.PEOPLE, people.id);
  }

  private async commentWalletAddress(id: string): Promise<TipsBalanceInfo> {
    const {networkId, networkIds} = await this.currentUserNetwork();
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
        throw new HttpErrors.NotFound('UserNotFound');
      }
      return this.tipsBalanceInfo(networkId, ReferenceType.USER, user.id);
    }

    return {
      referenceId: wallets[0].id,
      referenceType: ReferenceType.WALLETADDRESS,
    };
  }

  private async userWalletAddress(id: string): Promise<TipsBalanceInfo> {
    const {networkId, networkIds} = await this.currentUserNetwork();
    const toWalletUser = await this.walletRepository.findOne({
      where: {userId: id, networkId: {inq: networkIds}},
    });

    if (toWalletUser) {
      return {
        referenceId: toWalletUser.id,
        referenceType: ReferenceType.WALLETADDRESS,
      };
    }

    return this.tipsBalanceInfo(networkId, ReferenceType.USER, id);
  }

  private async unlockableContentWalletAddress(
    id: string,
  ): Promise<TipsBalanceInfo> {
    const {networkId, networkIds} = await this.currentUserNetwork();
    const unlockableContent = await this.unlockableContentRepository.findById(
      id,
      {
        include: ['user'],
      },
    );
    const toWalletUser = await this.walletRepository.findOne({
      where: {
        userId: unlockableContent.createdBy,
        networkId: {inq: networkIds},
      },
    });

    const userId = unlockableContent.createdBy;
    const referenceId = toWalletUser
      ? `${id}/${userId}/${toWalletUser.id}`
      : `${id}/${userId}`;

    return this.tipsBalanceInfo(
      networkId,
      ReferenceType.UNLOCKABLECONTENT,
      referenceId,
    );
  }

  private async currentUserNetwork(): Promise<NetworkDetail> {
    const wallet = await this.walletRepository.findOne({
      where: {
        userId: this.currentUser[securityId],
        primary: true,
      },
      include: ['network'],
    });

    if (!wallet?.network) {
      throw new HttpErrors.NotFound('NetworkNotExists');
    }

    const {id: networkId, blockchainPlatform} = wallet.network;
    const networks = await this.networkRepository.find({
      where: {blockchainPlatform},
    });
    const networkIds = networks.map(network => network.id);

    return {
      networkId,
      networkIds,
    };
  }

  private async tipsBalanceInfo(
    networkType: string,
    referenceType: ReferenceType,
    referenceId: string,
  ): Promise<TipsBalanceInfo> {
    const server = await this.serverRepository.findOne();
    const serverId = server?.accountId?.[networkType];

    if (!serverId) throw new HttpErrors.NotFound('ServerNotExists');

    const tipsBalanceInfo = {
      serverId: serverId,
      referenceType: referenceType,
      referenceId:
        referenceType === ReferenceType.UNLOCKABLECONTENT
          ? `${server.id}/${referenceId}`
          : referenceId,
    };

    return tipsBalanceInfo;
  }
}

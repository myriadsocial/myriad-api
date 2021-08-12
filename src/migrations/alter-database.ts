import {repository} from '@loopback/repository';
import {
  Currency,
  Friend,
  Notification,
  People,
  Post,
  Transaction,
  User,
  UserCurrency,
  UserSocialMedia,
} from '../models';
import {
  CurrencyRepository,
  FriendRepository,
  NotificationRepository,
  PeopleRepository,
  PostRepository,
  TransactionRepository,
  UserCurrencyRepository,
  UserRepository,
  UserSocialMediaRepository,
} from '../repositories';
import {PolkadotJs} from '../utils/polkadotJs-utils';

/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  @typescript-eslint/naming-convention */
export class AlterDatabase {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
    @repository(NotificationRepository)
    protected notificationRepository: NotificationRepository,
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
    @repository(UserCurrencyRepository)
    protected userCurrencyRepository: UserCurrencyRepository,
    @repository(UserSocialMediaRepository)
    protected userSocialMediaRepository: UserSocialMediaRepository,
  ) {}

  async updateUsers(): Promise<void> {
    await (this.userRepository.dataSource.connector as any).collection(User.modelName).updateMany(
      {},
      {
        $unset: {
          username: '',
          is_online: '',
          skip_tour: '',
          anonymous: '',
        },
      },
    );
  }

  async updatePosts(): Promise<void> {
    const collections = (this.postRepository.dataSource.connector as any).collection(
      Post.modelName,
    );

    await collections.updateMany(
      {},
      {
        $unset: {
          platformUser: '',
          hasMedia: '',
          tipsReceived: '',
          walletAddress: '',
        },
        $rename: {
          link: 'url',
          platformCreatedAt: 'originCreatedAt',
          importBy: 'importers',
          textId: 'originPostId',
        },
        $set: {
          metric: {
            likes: 0,
            dislikes: 0,
            comments: 0,
          },
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
        },
      },
    );

    const posts = await collections
      .aggregate([{$match: {$expr: {$gte: [{$size: '$importers'}, 1]}}}])
      .get();

    await Promise.all(
      posts.map((post: any) => {
        return this.postRepository.updateById(post._id, {createdBy: post.importers[0]});
      }),
    );
  }

  async updateTransactions(): Promise<void> {
    const collections = (this.transactionRepository.dataSource.connector as any).collection(
      Transaction.modelName,
    );

    await collections.updateMany(
      {},
      {
        $unset: {
          hasSendToUser: '',
          state: '',
        },
        $rename: {
          trxHash: 'hash',
          value: 'amount',
          tokenId: 'currencyId',
        },
      },
    );
  }

  async updateFriends(): Promise<void> {
    const collections = (this.friendRepository.dataSource.connector as any).collection(
      Friend.modelName,
    );

    await collections.updateMany(
      {},
      {
        $rename: {
          friendId: 'requesteeId',
        },
        $set: {
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
        },
      },
    );
  }

  async updateNotifications(): Promise<void> {
    const collections = (this.notificationRepository.dataSource.connector as any).collection(
      Notification.modelName,
    );

    await collections.updateMany(
      {},
      {
        $set: {
          read: false,
        },
      },
    );
  }

  async updateCurrencies(): Promise<void> {
    const collections = (this.currencyRepository.dataSource.connector as any).collection(
      Currency.modelName,
    );

    await collections.updateMany(
      {},
      {
        $rename: {
          token_name: 'name',
          token_image: 'image',
          token_decimal: 'decimal',
          address_format: 'addressType',
          rpc_address: 'rpcURL',
        },
        $set: {
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
        },
      },
    );

    await this.addNativeToCurrencies();
  }

  async updatePeople(): Promise<void> {
    const collections = (this.peopleRepository.dataSource.connector as any).collection(
      People.modelName,
    );

    await collections.updateMany(
      {},
      {
        $rename: {
          platform_account_id: 'originUserId',
          profile_image_url: 'profilePictureURL',
        },
        $unset: {
          hide: '',
        },
        $set: {
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
        },
      },
    );

    await this.addWalletaddresToPeople();
  }

  async updateUserCurrency(): Promise<void> {
    const collections = (this.userCurrencyRepository.dataSource.connector as any).collection(
      UserCurrency.modelName,
    );

    await collections.updateMany(
      {},
      {
        $rename: {
          tokenId: 'currencyId',
        },
      },
    );
  }

  async updateUserSocialMedia(): Promise<void> {
    const collections = (this.userSocialMediaRepository.dataSource.connector as any).collection(
      UserSocialMedia.modelName,
    );

    await collections.updateMany(
      {},
      {
        $rename: {
          isVerified: 'verified',
        },
      },
    );
  }

  async addWalletaddresToPeople(): Promise<void> {
    const people = await this.peopleRepository.find();
    const {getKeyring, getHexPublicKey} = new PolkadotJs();

    await Promise.all(
      people.map(person => {
        const newKey = getKeyring().addFromUri('//' + person.id);
        const walletAddress = getHexPublicKey(newKey);

        return this.peopleRepository.updateById(person.id, {walletAddress: walletAddress});
      }),
    );
  }

  async addNativeToCurrencies(): Promise<void> {
    const currencies = await this.currencyRepository.find();

    await Promise.all(
      currencies.map(currency => {
        if (currency.id === 'MYRIA' || currency.id === 'ACA') {
          currency.native = true;
        } else {
          currency.native = false;
        }

        return this.currencyRepository.updateById(currency.id, currency);
      }),
    );
  }
}

import {repository} from '@loopback/repository';
import {MigrationScript, migrationScript} from 'loopback4-migration';
import {config} from '../config';
import {
  DefaultCurrencyType,
  FriendStatusType,
  PlatformType,
  ReferenceType,
  VisibilityType,
} from '../enums';
import {
  Conversation,
  DetailTransaction,
  Dislike,
  Friend,
  Like,
  Notification,
  People,
  Post,
  PublicMetric,
  Tip,
  Token,
  Transaction,
  UserCredential,
  UserToken,
} from '../models';
import {
  ConversationRepository,
  CurrencyRepository,
  DetailTransactionRepository,
  DislikeRepository,
  FriendRepository,
  LikeRepository,
  NotificationRepository,
  PeopleRepository,
  PostImporterRepository,
  PostRepository,
  PublicMetricRepository,
  TipRepository,
  TokenRepository,
  TransactionRepository,
  UserCredentialRepository,
  UserCurrencyRepository,
  UserExperienceRepository,
  UserRepository,
  UserSocialMediaRepository,
  UserTokenRepository,
  VoteRepository,
} from '../repositories';
import {PolkadotJs} from '../utils/polkadotJs-utils';
import acala from '../data-seed/currencies.json';
import {BcryptHasher} from '../services/authentication/hash.password.service';

/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  @typescript-eslint/naming-convention */
@migrationScript()
export class MigrationScript100 implements MigrationScript {
  version = '1.0.0';

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
    @repository(LikeRepository)
    protected likeRepository: LikeRepository,
    @repository(TokenRepository)
    protected tokenRepository: TokenRepository,
    @repository(PublicMetricRepository)
    protected publicMetricRepository: PublicMetricRepository,
    @repository(UserTokenRepository)
    protected userTokenRepository: UserTokenRepository,
    @repository(UserCredentialRepository)
    protected userCredentialRepository: UserCredentialRepository,
    @repository(ConversationRepository)
    protected conversationRepository: ConversationRepository,
    @repository(DetailTransactionRepository)
    protected detailTransactionRepository: DetailTransactionRepository,
    @repository(TipRepository)
    protected tipRepository: TipRepository,
    @repository(DislikeRepository)
    protected dislikeRepository: DislikeRepository,
    @repository(VoteRepository)
    protected voteRepository: VoteRepository,
    @repository(UserExperienceRepository)
    protected userExperienceRepository: UserExperienceRepository,
    @repository(PostImporterRepository)
    protected postImporterRepository: PostImporterRepository,
  ) {}

  async up(): Promise<void> {
    await this.doMigrateUsers();
    await this.doMigrateCurrencies();
    await this.doMigratePosts();
    await this.doMigrateUserCurrencies();
    await this.doMigrateTransactions();
    await this.doMigratePeople();
    await this.doMigrateNotifications();
    await this.doMigrateFriends();
    await this.doMigrateUserSocialMedias();
    await this.doMigrateLikes();
    await this.doMigrateVotes();
    await this.doMigratePostImporter();

    await this.dropPublicMetrics();
    await this.dropConversations();
    await this.dropDetailTransactions();
    await this.dropTips();
  }

  async doMigrateUsers(): Promise<void> {
    await this.userRepository.updateAll(<any>{
      $unset: {
        is_online: '',
        skip_tour: '',
        anonymous: '',
        seed_example: '',
      },
      $set: {
        defaultCurrency: DefaultCurrencyType.AUSD,
      },
    });

    const users = await this.userRepository.find();

    await Promise.all(
      users.map(async user => {
        const username = user.username
          ? user.username
          : user.name.replace(/\s+/g, '').toLowerCase() +
            '.' +
            Math.random().toString(36).substr(2, 9);

        const {count: totalExperiences} =
          await this.userExperienceRepository.count({
            userId: user.id,
          });
        const {count: totalFriends} = await this.friendRepository.count({
          or: [
            {
              requesteeId: user.id,
              status: FriendStatusType.APPROVED,
            },
            {
              requestorId: user.id,
              status: FriendStatusType.APPROVED,
            },
          ],
        });
        const {count: totalPosts} = await this.postRepository.count({
          createdBy: user.id,
          platform: PlatformType.MYRIAD,
        });

        return this.userRepository.updateById(user.id, {
          username,
          metric: {
            totalExperiences,
            totalFriends,
            totalPosts,
            totalKudos: 0,
          },
        });
      }),
    );
  }

  async doMigrateCurrencies(): Promise<void> {
    const collection = (
      this.tokenRepository.dataSource.connector as any
    ).collection(Token.modelName);

    const tokens = await collection.aggregate().get();

    await Promise.all(
      tokens.map(async (token: any) => {
        const currency = await this.currencyRepository.findOne({
          where: {id: token._id},
        });

        if (currency) return currency;
        return this.currencyRepository.create({
          id: token._id,
          image: token.token_image,
          decimal: token.token_decimal,
          rpcURL: token.rpc_address,
          native: token._id === 'MYRIA' || token._id === 'ACA' ? true : false,
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
        });
      }),
    );

    try {
      await collection.drop();
    } catch {
      // ignore
    }

    try {
      await this.currencyRepository.updateById(DefaultCurrencyType.MYRIA, {
        decimal: 18,
      });
    } catch {
      // ignore
    }

    const acalaTokens = ['ACA', 'AUSD', 'DOT'];

    for (const token of acalaTokens) {
      try {
        await this.currencyRepository.updateById(token, {
          types: acala[0].types,
        });
      } catch {
        // ignore
      }
    }
  }

  async doMigratePosts(): Promise<void> {
    const {getKeyring, getHexPublicKey} = new PolkadotJs();
    const collection = (
      this.postRepository.dataSource.connector as any
    ).collection(Post.modelName);

    // Renamed and removed field
    await collection.updateMany(
      {},
      {
        $unset: {
          platformUser: '',
          hasMedia: '',
          tipsReceived: '',
          totalComment: '',
          totalLiked: '',
          totalDisliked: '',
        },
        $rename: {
          link: 'url',
          platformCreatedAt: 'originCreatedAt',
          importBy: 'importers',
          textId: 'originPostId',
        },
        $set: {
          metric: {
            upvotes: 0,
            downvotes: 0,
            discussions: 0,
            debates: 0,
            shares: 0,
          },
          popularCount: 0,
          visibility: VisibilityType.PUBLIC,
          mentions: [],
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
        },
      },
    );

    // rename walletAddress to createdBy for myriad post
    await collection.updateMany(
      {platform: PlatformType.MYRIAD},
      {
        $rename: {
          walletAddress: 'createdBy',
        },
      },
    );

    // set createdBy if platform is not myriad
    const posts = await collection
      .aggregate([{$match: {platform: {$ne: PlatformType.MYRIAD}}}])
      .get();

    await Promise.all(
      posts.map(async (post: any) => {
        if (
          post.importers &&
          typeof post.importers === 'object' &&
          post.importers.length > 0
        ) {
          return this.postRepository.updateById(post._id, <any>{
            createdBy: post.importers[0],
          });
        } else {
          const mnemonic = config.MYRIAD_MNEMONIC;
          const pair = getKeyring().addFromMnemonic(mnemonic);

          return this.postRepository.updateById(post._id, <any>{
            createdBy: getHexPublicKey(pair),
          });
        }
      }),
    );

    // update asset
    const postAssets = await collection.aggregate().get();

    await Promise.all(
      postAssets.map(async (post: any) => {
        if (!post.assets || post.assets.length === 0) {
          return collection.updateOne(
            {_id: post._id},
            {
              $unset: {
                assets: '',
              },
              $set: {
                asset: {
                  images: [],
                  videos: [],
                },
              },
            },
          );
        } else {
          const imageFormat =
            /[.]jpg$|[.]jpeg$|[.]png$|[.]gif$|[.]tiff$|^https:\/\/preview.redd.it\//;
          const videoFormat = /[.]mp4$|[.]mp4?source=fallback$/;

          const images = post.assets.filter((asset: string) =>
            asset.match(imageFormat),
          );
          const videos = post.assets.filter((asset: string) =>
            asset.match(videoFormat),
          );

          return collection.updateOne(
            {_id: post._id},
            {
              $unset: {
                assets: '',
              },
              $set: {
                asset: {
                  images: images,
                  videos: videos,
                },
              },
            },
          );
        }
      }),
    );
  }

  async doMigratePostImporter(): Promise<void> {
    const collection = (
      this.postRepository.dataSource.connector as any
    ).collection(Post.modelName);

    const posts = await collection.aggregate().get();

    for (const post of posts) {
      if (!post.importers) continue;
      if (
        post.importers &&
        typeof post.importers === 'object' &&
        post.importers.length === 0
      )
        continue;

      await Promise.all(
        post.importers.map((importer: string) => {
          return this.postImporterRepository.create({
            postId: post._id,
            importerId: importer,
          });
        }),
      );

      await collection.updateMany(
        {},
        {
          $unset: {
            importers: '',
          },
        },
      );
    }
  }

  async doMigrateUserCurrencies(): Promise<void> {
    const collection = (
      this.userTokenRepository.dataSource.connector as any
    ).collection(UserToken.modelName);

    const userTokens = await collection.aggregate().get();

    await Promise.all(
      userTokens.map(async (userToken: any) => {
        const user = await this.userRepository.findOne({
          where: {id: userToken.userId},
        });

        if (!user) return null;
        return this.userCurrencyRepository.create({
          userId: userToken.userId,
          currencyId: userToken.tokenId,
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
        });
      }),
    );

    try {
      await collection.drop();
    } catch {
      // ignore
    }
  }

  async doMigrateTransactions(): Promise<void> {
    const collection = (
      this.transactionRepository.dataSource.connector as any
    ).collection(Transaction.modelName);

    await collection.updateMany(
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
          postId: 'referenceId',
        },
      },
    );

    await collection.updateMany(
      {currencyId: DefaultCurrencyType.MYRIA},
      {
        $set: {
          amount: 1,
        },
      },
    );

    const transactions = await collection
      .aggregate([{$match: {referenceId: {$exists: true}}}])
      .get();

    await Promise.all(
      transactions.map((transaction: any) => {
        if (transaction.referenceId) {
          this.transactionRepository.updateById(transaction._id, {
            type: ReferenceType.POST,
          }) as Promise<void>;
        }

        return null;
      }),
    );
  }

  async doMigratePeople(): Promise<void> {
    const collections = (
      this.peopleRepository.dataSource.connector as any
    ).collection(People.modelName);

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

  async doMigrateNotifications(): Promise<void> {
    const collections = (
      this.notificationRepository.dataSource.connector as any
    ).collection(Notification.modelName);

    await collections.updateMany(
      {},
      {
        $set: {
          read: false,
        },
      },
    );
  }

  async doMigrateFriends(): Promise<void> {
    const collection = (
      this.friendRepository.dataSource.connector as any
    ).collection(Friend.modelName);

    await collection.updateMany(
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

    await collection.deleteMany({status: 'rejected'});
  }

  async doMigrateUserSocialMedias(): Promise<void> {
    const collection = (
      this.userCredentialRepository.dataSource.connector as any
    ).collection(UserCredential.modelName);

    await collection.updateMany(
      {},
      {
        $rename: {
          isVerified: 'verified',
        },
        $set: {
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
        },
      },
    );

    const newUserSocialMedias = (await collection.aggregate().get()).map(
      (userSocialMedia: any) => {
        if (userSocialMedia._id) {
          delete userSocialMedia._id;
        }

        return userSocialMedia;
      },
    );

    await this.userSocialMediaRepository.createAll(newUserSocialMedias);

    try {
      await collection.drop();
    } catch {
      // ignore
    }
  }

  async doMigrateLikes(): Promise<void> {
    const collection = (
      this.likeRepository.dataSource.connector as any
    ).collection(Like.modelName);

    await collection.deleteMany({status: false});
    await collection.updateMany(
      {},
      {
        $set: {
          type: ReferenceType.POST,
          state: true,
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
        },
        $unset: {
          status: '',
        },
        $rename: {
          postId: 'referenceId',
        },
      },
    );

    await this.addDislikesToLikeCollection();
  }

  async doMigrateVotes(): Promise<void> {
    const collection = (
      this.likeRepository.dataSource.connector as any
    ).collection(Like.modelName);
    const likes = await collection.aggregate().get();

    await Promise.all(
      likes.map(async (like: any) => {
        delete like._id;
        return this.voteRepository.create(like);
      }),
    );

    try {
      await collection.drop();
    } catch {
      // ignore
    }
  }

  async dropPublicMetrics() {
    const collection = (
      this.publicMetricRepository.dataSource.connector as any
    ).collection(PublicMetric.modelName);

    const publicMetrics = await collection
      .aggregate([
        {
          $match: {
            $or: [
              {
                liked: {$gt: 0},
              },
              {
                disliked: {$gt: 0},
              },
              {
                comment: {$gt: 0},
              },
            ],
          },
        },
      ])
      .get();

    await Promise.all(
      publicMetrics.map(async (metric: any) => {
        const post = await this.postRepository.findOne({
          where: {id: metric.postId},
        });

        if (!post) return null;
        return this.postRepository.updateById(metric.postId, {
          metric: {
            upvotes: metric.upvotes,
            downvotes: metric.downvotes,
            discussions: metric.comment,
            debates: 0,
          },
        });
      }),
    );

    try {
      await collection.drop();
    } catch {
      // ignore
    }
  }

  async dropConversations() {
    const collection = (
      this.conversationRepository.dataSource.connector as any
    ).collection(Conversation.modelName);

    try {
      await collection.drop();
    } catch {
      // ignore
    }
  }

  async dropDetailTransactions() {
    const collection = (
      this.detailTransactionRepository.dataSource.connector as any
    ).collection(DetailTransaction.modelName);

    try {
      await collection.drop();
    } catch {
      // ignore
    }
  }

  async dropTips() {
    const collection = (
      this.tipRepository.dataSource.connector as any
    ).collection(Tip.modelName);

    try {
      await collection.drop();
    } catch {
      // ignore
    }
  }

  async addWalletaddresToPeople(): Promise<void> {
    const people = await this.peopleRepository.find();
    const {getKeyring, getHexPublicKey} = new PolkadotJs();

    await Promise.all(
      people.map(async person => {
        const hasher = new BcryptHasher();
        const hashPeopleId = await hasher.hashPassword(
          person.id + config.ESCROW_SECRET_KEY,
        );
        const newKey = getKeyring().addFromUri('//' + hashPeopleId);
        const walletAddress = getHexPublicKey(newKey);

        return this.peopleRepository.updateById(person.id, {
          walletAddress: walletAddress,
        });
      }),
    );
  }

  async addDislikesToLikeCollection(): Promise<void> {
    const collection = (
      this.dislikeRepository.dataSource.connector as any
    ).collection(Dislike.modelName);

    await collection.deleteMany({status: false});
    await collection.updateMany(
      {},
      {
        $set: {
          type: ReferenceType.POST,
          state: true,
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
        },
        $unset: {
          status: '',
        },
        $rename: {
          postId: 'referenceId',
        },
      },
    );

    const dislikes = (await collection.aggregate().get()).map(
      (dislike: any) => {
        if (dislike._id) {
          delete dislike._id;
        }

        return dislike;
      },
    );

    await this.likeRepository.createAll(dislikes);

    try {
      await collection.drop();
    } catch {
      // ignore
    }
  }
}

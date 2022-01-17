import {AuthenticationComponent} from '@loopback/authentication';
import {BootMixin} from '@loopback/boot';
import {ApplicationConfig, createBindingFromClass} from '@loopback/core';
import {HealthComponent} from '@loopback/health';
import {
  SchemaMigrationOptions,
  RepositoryMixin,
  AnyObject,
} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {
  RestExplorerBindings,
  RestExplorerComponent,
} from '@loopback/rest-explorer';
import {ServiceMixin} from '@loopback/service-proxy';
import * as firebaseAdmin from 'firebase-admin';
import {config} from './config';
import path from 'path';
import {JWTAuthenticationComponent} from './components';
import {
  CoinMarketCapDataSource,
  RedditDataSource,
  TwitterDataSource,
} from './datasources';
import {MyriadSequence} from './sequence';
import {
  CurrencyService,
  ExperienceService,
  FCMService,
  FriendService,
  MetricService,
  NotificationService,
  PostService,
  SocialMediaService,
  TagService,
  TransactionService,
  UserSocialMediaService,
  ActivityLogService,
  CoinMarketCapProvider,
  RedditProvider,
  TwitterProvider,
} from './services';
import {
  UpdateExchangeRateJob,
  UpdateTrendingTopicJob,
  UpdatePeopleProfileJob,
} from './jobs';
import {CronComponent} from '@loopback/cron';
import * as Sentry from '@sentry/node';
import multer from 'multer';
import {v4 as uuid} from 'uuid';
import {FILE_UPLOAD_SERVICE} from './keys';
import {FCSService} from './services/fcs.service';
import {
  AccountSettingRepository,
  ActivityLogRepository,
  CommentRepository,
  CurrencyRepository,
  DraftPostRepository,
  ExchangeRateRepository,
  ExperienceRepository,
  ExperienceUserRepository,
  FriendRepository,
  LeaderBoardRepository,
  NotificationRepository,
  PeopleRepository,
  PostRepository,
  TransactionRepository,
  UserCurrencyRepository,
  UserExperienceRepository,
  UserReportRepository,
  UserRepository,
  UserSocialMediaRepository,
  VoteRepository,
} from './repositories';
import {DefaultCurrencyType, NotificationType, PlatformType} from './enums';
import {People, Post, User} from './models';
import {BcryptHasher} from './services/authentication/hash.password.service';
import NonceGenerator from 'a-nonce-generator';

export {ApplicationConfig};

export class MyriadApiApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    // Set up default home page
    this.static('/', path.join(__dirname, '../public'));
    // Set up the custom sequence
    this.sequence(MyriadSequence);
    this.configureFileUpload();
    this.configureFirebase();
    this.configureSentry();
    // Register component
    this.registerComponent();
    // Register services
    this.registerService();
    // Register job
    this.registerJob();

    this.projectRoot = __dirname;
    this.bootOptions = {
      controllers: {
        // Customize ControllerBooter Conventions here
        dirs: ['controllers'],
        extensions: ['.controller.js'],
        nested: true,
      },
    };
  }

  registerComponent() {
    this.component(HealthComponent);
    this.component(CronComponent);
    this.component(AuthenticationComponent);
    this.component(JWTAuthenticationComponent);

    this.configure(RestExplorerBindings.COMPONENT).to({
      path: '/explorer',
    });
    this.component(RestExplorerComponent);
  }

  registerService() {
    this.service(NotificationService);
    this.service(FriendService);
    this.service(UserSocialMediaService);
    this.service(TransactionService);
    this.service(SocialMediaService);
    this.service(CurrencyService);
    this.service(PostService);
    this.service(TagService);
    this.service(ExperienceService);
    this.service(MetricService);
    this.service(ActivityLogService);

    // 3rd party service
    this.service(FCMService);
    this.service(FCSService);
  }

  registerJob() {
    this.add(createBindingFromClass(UpdateExchangeRateJob));
    this.add(createBindingFromClass(UpdateTrendingTopicJob));
    this.add(createBindingFromClass(UpdatePeopleProfileJob));
  }

  configureFileUpload() {
    if (this.options.test) return;
    const multerOptions: multer.Options = {
      storage: multer.diskStorage({
        filename: (req, file, cb) => {
          cb(null, `${uuid()}${path.extname(file.originalname)}`);
        },
      }),
    };
    // Configure the file upload service with multer options
    this.configure(FILE_UPLOAD_SERVICE).to(multerOptions);
  }

  configureFirebase() {
    if (this.options.test) return;
    firebaseAdmin.initializeApp({
      storageBucket: config.FIREBASE_STORAGE_BUCKET,
    });
  }

  configureSentry() {
    if (this.options.test || !config.SENTRY_DSN) return;
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 1.0,
    });
  }

  async migrateSchema(options?: SchemaMigrationOptions): Promise<void> {
    await super.migrateSchema(options);

    if (options?.existingSchema === 'drop') {
      return this.doCreateIntialUser();
    }

    await this.doMigrateUserNonce();
    await this.doMigrateMyriadPublicKey();
    await this.doMigratePost();
    await this.doRemoveCollection();
    await this.doUpdatePeopleWallet();
    await this.doChangeBaseStorageURL();
  }

  async doCreateIntialUser(): Promise<void> {
    const {userRepository} = await this.repositories();

    const user = await userRepository.create({
      id: config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY,
      name: 'Myriad Official',
      username: 'myriad_official',
      profilePictureURL:
        'https://pbs.twimg.com/profile_images/1407599051579617281/-jHXi6y5_400x400.jpg',
      bannerImageUrl:
        'https://pbs.twimg.com/profile_banners/1358714439583690753/1624432887/1500x500',
      bio: 'A social metaverse & metasocial network on web3, pulling content from mainstream social media and turning every post into a tipping wallet.',
      websiteURL: 'https://www.myriad.social/',
    });

    await userRepository.accountSetting(user.id).create({});
    await userRepository.notificationSetting(user.id).create({});
    await userRepository.leaderboard(user.id).create({});
    await userRepository.currencies(user.id).delete({
      id: DefaultCurrencyType.MYRIA,
    });
    await userRepository.currencies(user.id).create({
      id: DefaultCurrencyType.MYRIA,
      decimal: 18,
      image:
        'https://pbs.twimg.com/profile_images/1407599051579617281/-jHXi6y5_400x400.jpg',
      rpcURL: config.MYRIAD_RPC_WS_URL,
      native: true,
      networkType: 'substrate',
      exchangeRate: false,
    });

    console.log('initial user have been successfully created');
  }

  // One time only
  async doMigrateUserNonce(): Promise<void> {
    const {userRepository} = await this.repositories();
    const ng = new NonceGenerator();
    const nonce = ng.generate();

    const collection = (
      userRepository.dataSource.connector as AnyObject
    ).collection(User.modelName);

    await collection.updateMany(
      {},
      {
        $set: {
          nonce: nonce,
        },
        $unset: {
          password: '',
          autoGeneratedPassword: '',
          gunPub: '',
          gunEpub: '',
        },
      },
    );

    console.log('user nonce have been successfully updated');
  }

  async doMigrateMyriadPublicKey(): Promise<void> {
    const userRepository = await this.getRepository(UserRepository);
    const myriad = await userRepository.findOne({
      where: {username: 'myriad_official'},
    });

    await this.updateMyriadIdInAllCollection(myriad);
  }

  // One time only
  async doMigratePost(): Promise<void> {
    if (!this.options.migrate) return;

    const {postRepository} = await this.repositories();
    const {count} = await postRepository.count();

    for (let i = 0; i < count; i++) {
      const [post] = await postRepository.find({
        limit: 1,
        skip: i,
        where: {
          platform: {
            nin: [PlatformType.MYRIAD],
          },
        },
      });

      if (!post) continue;

      const data: Partial<Post> = {
        text: `"${post.text}"`,
      };

      if (post.platform === PlatformType.REDDIT) {
        data.title = `"${post.title}"`;
      }

      await postRepository.updateById(post.id, data);

      console.log('posts have been successfully updated');
    }
  }

  // one time only
  // Need migration every time changed environment
  async doRemoveCollection(): Promise<void> {
    if (!this.options.migrate) return;

    const {notificationRepository} = await this.repositories();

    await notificationRepository.deleteAll({
      or: [
        {type: NotificationType.COMMENT_TIPS},
        {type: NotificationType.POST_TIPS},
        {type: NotificationType.USER_REWARD},
        {type: NotificationType.USER_INITIAL_TIPS},
        {type: NotificationType.USER_CLAIM_TIPS},
      ],
    });

    console.log(
      'notification related to tipping have been successfully removed',
    );
  }

  // Need migration every time changed environment
  async doChangeBaseStorageURL(): Promise<void> {
    const {
      userRepository,
      currencyRepository,
      experienceRepository,
      postRepository,
    } = await this.repositories();

    const baseStorageURL: {[key: string]: string} = {
      development:
        'https://storage.googleapis.com/myriad-substrate-development.appspot.com',
      staging:
        'https://storage.googleapis.com/myriad-substrate-staging.appspot.com',
      testnet:
        'https://storage.googleapis.com/myriad-social-testnet.appspot.com',
      mainnet:
        'https://storage.googleapis.com/myriad-social-mainnet.appspot.com',
    };
    const newBaseStorageURL = baseStorageURL[this.options.env];
    const oldStorageURL: string[] = [];

    for (const property in baseStorageURL) {
      if (property !== this.options.env) {
        oldStorageURL.push(baseStorageURL[property]);
      }
    }
    const regexp = new RegExp(oldStorageURL.join('|'), 'i');

    // Replace base storage url in user collection
    const {count: countUser} = await userRepository.count();

    for (let i = 0; i < countUser; i++) {
      const [user] = await userRepository.find({
        limit: 1,
        skip: i,
      });

      await userRepository.updateById(user.id, {
        profilePictureURL: user.profilePictureURL?.replace(
          regexp,
          newBaseStorageURL,
        ),
        bannerImageUrl: user.bannerImageUrl?.replace(regexp, newBaseStorageURL),
      });
    }

    console.log('user image have been successfully updated');

    // Replace base storage url in currency collection
    const {count: countCurrency} = await currencyRepository.count();

    for (let i = 0; i < countCurrency; i++) {
      const [currency] = await currencyRepository.find({
        limit: 1,
        skip: i,
      });

      await currencyRepository.updateById(currency.id, {
        image: currency.image?.replace(regexp, newBaseStorageURL),
      });
    }

    console.log('currency image have been successfully updated');

    // Replace base storage url in experience collection
    const {count: countExperience} = await experienceRepository.count();

    for (let i = 0; i < countExperience; i++) {
      const [experience] = await experienceRepository.find({
        limit: 1,
        skip: i,
      });

      await experienceRepository.updateById(experience.id, {
        experienceImageURL: experience.experienceImageURL?.replace(
          regexp,
          newBaseStorageURL,
        ),
      });
    }

    console.log('experience image have been successfully updated');

    // Replace base storage url in post collection
    const {count: countPost} = await postRepository.count();

    for (let i = 0; i < countPost; i++) {
      const [post] = await postRepository.find({
        limit: 1,
        skip: i,
      });

      await postRepository.updateById(post.id, {
        text: post.text?.replace(regexp, newBaseStorageURL),
      });
    }

    console.log('post image have been successfully updated');
  }

  // Need migration every time changed environment
  async doUpdatePeopleWallet(): Promise<void> {
    const {peopleRepository} = await this.repositories();
    const {count} = await peopleRepository.count();

    const foundPeople = await peopleRepository.findOne();
    const hasher = new BcryptHasher();

    for (let i = 0; i < count; i++) {
      const [people] = await peopleRepository.find({
        limit: 1,
        skip: i,
      });

      const hashPeopleId = await hasher.hashPassword(
        people.id + config.MYRIAD_ESCROW_SECRET_KEY,
      );

      const match = await hasher.comparePassword(
        hashPeopleId,
        foundPeople.walletAddressPassword,
      );

      if (match) continue;

      await peopleRepository.updateById(people.id, {
        walletAddressPassword: hashPeopleId,
      });
    }

    console.log('people wallet address have been successfully updated');
  }

  async updateMyriadIdInAllCollection(
    myriadOfficial: User | null,
  ): Promise<void> {
    if (!myriadOfficial) return;
    if (myriadOfficial.id === config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY) return;

    const {
      accountSettingRepository,
      activityLogRepository,
      commentRepository,
      draftPostRepository,
      experienceUserRepository,
      experienceRepository,
      friendRepository,
      leaderBoardRepository,
      notificationRepository,
      notificationSettingRepository,
      postRepository,
      transactionRepository,
      userRepository,
      userCurrencyRepository,
      userExperienceRepository,
      userReportRepository,
      userSocMedRepository,
      voteRepository,
    } = await this.repositories();

    const id = config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY;
    const oldPublicKey = myriadOfficial.id;

    await userRepository.deleteById(oldPublicKey);
    await userRepository.create(Object.assign(myriadOfficial, {id}));

    let data: AnyObject = {userId: id};
    let where: AnyObject = {userId: oldPublicKey};
    await accountSettingRepository.updateAll(data, where);

    await activityLogRepository.updateAll(data, where);
    await commentRepository.updateAll(data, where);
    await experienceUserRepository.updateAll(data, where);
    await leaderBoardRepository.updateAll(data, where);
    await notificationSettingRepository.updateAll(data, where);
    await userCurrencyRepository.updateAll(data, where);
    await userExperienceRepository.updateAll(data, where);
    await userSocMedRepository.updateAll(data, where);
    await voteRepository.updateAll(data, where);

    data = {referenceId: id};
    where = {referenceId: oldPublicKey};
    await activityLogRepository.updateAll(data, where);
    await notificationRepository.updateAll(data, where);
    await transactionRepository.updateAll(data, where);

    data = {createdBy: id};
    where = {createdBy: oldPublicKey};
    await draftPostRepository.updateAll(data, where);
    await experienceRepository.updateAll(data, where);
    await postRepository.updateAll(data, where);

    data = {requesteeId: id};
    where = {requesteeId: oldPublicKey};
    await friendRepository.updateAll(data, where);

    data = {requestorId: id};
    where = {requestorId: oldPublicKey};
    await friendRepository.updateAll(data, where);

    data = {from: id};
    where = {from: oldPublicKey};
    await notificationRepository.updateAll(data, where);
    await transactionRepository.updateAll(data, where);

    data = {to: id};
    where = {to: oldPublicKey};
    await notificationRepository.updateAll(data, where);
    await transactionRepository.updateAll(data, where);

    data = {reportedBy: id};
    where = {reportedBy: oldPublicKey};
    await userReportRepository.updateAll(data, where);

    data = {toUserId: id};
    where = {toUserId: oldPublicKey};
    await voteRepository.updateAll(data, where);

    console.log('myriad public key have been successfully changed');
  }

  async initialPeopleProfile(): Promise<void> {
    const peopleRepository = await this.getRepository(PeopleRepository);
    const redditDataSource = new RedditDataSource();
    const twitterDataSource = new TwitterDataSource();

    const redditService = await new RedditProvider(redditDataSource).value();
    const twitterService = await new TwitterProvider(twitterDataSource).value();

    const people = await peopleRepository.find();

    await Promise.all(
      people.map(async person => {
        const platform = person.platform;

        if (platform === PlatformType.REDDIT) {
          try {
            const {data: user} = await redditService.getActions(
              'user/' + person.username + '/about.json',
            );

            const updatedPeople = new People({
              name: user.subreddit.title ? user.subreddit.title : user.name,
              username: user.name,
              originUserId: 't2_' + user.id,
              profilePictureURL: user.icon_img.split('?')[0],
            });

            return await peopleRepository.updateById(person.id, updatedPeople);
          } catch {
            // ignore
          }
        }

        if (platform === PlatformType.TWITTER) {
          try {
            const {user} = await twitterService.getActions(
              `1.1/statuses/show.json?id=${person.originUserId}&include_entities=true&tweet_mode=extended`,
            );

            const updatedPeople = new People({
              name: user.name,
              username: user.screen_name,
              originUserId: user.id_str,
              profilePictureURL: user.profile_image_url_https || '',
            });

            return await peopleRepository.updateById(person.id, updatedPeople);
          } catch {
            // ignore
          }
        }
      }),
    );
  }

  async initialExchangeRates(): Promise<void> {
    const currencyRepository = await this.getRepository(CurrencyRepository);
    const exchangeRateRepository = await this.getRepository(
      ExchangeRateRepository,
    );

    const dataSource = new CoinMarketCapDataSource();
    const coinMarketCapService = await new CoinMarketCapProvider(
      dataSource,
    ).value();

    const currencies = await currencyRepository.find({
      where: {
        exchangeRate: true,
      },
    });

    const currencyIds = currencies.map(currency => currency.id);

    if (currencyIds.length === 0) return;

    try {
      const {data} = await coinMarketCapService.getActions(
        `cryptocurrency/quotes/latest?symbol=${currencyIds.join(',')}`,
      );

      for (const currencyId of currencyIds) {
        const price = data[currencyId].quote.USD.price;
        const found = await exchangeRateRepository.findOne({
          where: {
            id: currencyId,
          },
        });

        if (found) {
          await exchangeRateRepository.updateById(currencyId, {
            price: price,
            updatedAt: new Date().toString(),
          });
        } else {
          await exchangeRateRepository.create({
            id: currencyId,
            price: price,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  async repositories(): Promise<AnyObject> {
    const accountSettingRepository = await this.getRepository(
      AccountSettingRepository,
    );
    const activityLogRepository = await this.getRepository(
      ActivityLogRepository,
    );
    const commentRepository = await this.getRepository(CommentRepository);
    const currencyRepository = await this.getRepository(CurrencyRepository);
    const draftPostRepository = await this.getRepository(DraftPostRepository);
    const experienceUserRepository = await this.getRepository(
      ExperienceUserRepository,
    );
    const experienceRepository = await this.getRepository(ExperienceRepository);
    const friendRepository = await this.getRepository(FriendRepository);
    const leaderBoardRepository = await this.getRepository(
      LeaderBoardRepository,
    );
    const notificationRepository = await this.getRepository(
      NotificationRepository,
    );
    const notificationSettingRepository = await this.getRepository(
      NotificationRepository,
    );
    const peopleRepository = await this.getRepository(PeopleRepository);
    const postRepository = await this.getRepository(PostRepository);
    const transactionRepository = await this.getRepository(
      TransactionRepository,
    );
    const userRepository = await this.getRepository(UserRepository);
    const userCurrencyRepository = await this.getRepository(
      UserCurrencyRepository,
    );
    const userExperienceRepository = await this.getRepository(
      UserExperienceRepository,
    );
    const userReportRepository = await this.getRepository(UserReportRepository);
    const userSocMedRepository = await this.getRepository(
      UserSocialMediaRepository,
    );
    const voteRepository = await this.getRepository(VoteRepository);

    return {
      accountSettingRepository,
      activityLogRepository,
      commentRepository,
      currencyRepository,
      draftPostRepository,
      experienceUserRepository,
      experienceRepository,
      friendRepository,
      leaderBoardRepository,
      notificationRepository,
      notificationSettingRepository,
      peopleRepository,
      postRepository,
      transactionRepository,
      userRepository,
      userCurrencyRepository,
      userExperienceRepository,
      userReportRepository,
      userSocMedRepository,
      voteRepository,
    };
  }
}

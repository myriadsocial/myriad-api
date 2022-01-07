import {AuthenticationComponent} from '@loopback/authentication';
import {BootMixin} from '@loopback/boot';
import {ApplicationConfig, createBindingFromClass} from '@loopback/core';
import {HealthComponent} from '@loopback/health';
import {
  AnyObject,
  RepositoryMixin,
  SchemaMigrationOptions,
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
  UserService,
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
  NotificationRepository,
  NotificationSettingRepository,
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
import {Currency, Experience, People, Post, User} from './models';
import {BcryptHasher} from './services/authentication/hash.password.service';

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

    if (this.options.test) return;
    if (
      Object.values(this.options).length === 0 ||
      !this.options.rest.apiExplorer.disabled
    ) {
      this.configure(RestExplorerBindings.COMPONENT).to({
        path: '/explorer',
        useSelfHostedSpec: true,
      });
      this.component(RestExplorerComponent);
    }
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
    this.service(UserService);

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

    await this.doMigrateUser();
    await this.doMigrateMyriadPublicKey();
    await this.doRemoveDocument();
    await this.doUpdatePeopleWallet();
    await this.doChangeBaseStorageURL();
  }

  async doCreateIntialUser(): Promise<void> {
    if (this.options.alter.indexOf('user') === -1) return;
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
    await userRepository.languageSetting(user.id).create({});
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

  async doMigrateUser(): Promise<void> {
    if (this.options.alter.indexOf('user') === -1) return;
    const {userRepository} = await this.repositories();
    const {count} = await userRepository.count();

    for (let i = 0; i < count; i++) {
      const [user] = await userRepository.find({
        limit: 1,
        skip: i,
        include: ['languangeSetting'],
      });

      if (user.languageSetting) continue;

      await userRepository.languageSetting(user.id).create({});
    }

    console.log('language settings have been successfully updated');
  }

  async doMigrateMyriadPublicKey(): Promise<void> {
    const userRepository = await this.getRepository(UserRepository);
    const myriad = await userRepository.findOne({
      where: {username: 'myriad_official'},
    });

    await this.updateMyriadIdInAllCollection(myriad);
  }

  async doRemoveDocument(): Promise<void> {
    if (this.options.drop.indexOf('document') === -1) return;
    const {currencyRepository, notificationRepository, userSocMedRepository} =
      await this.repositories();

    await notificationRepository.deleteAll({
      or: [
        {type: NotificationType.COMMENT_TIPS},
        {type: NotificationType.POST_TIPS},
        {type: NotificationType.USER_REWARD},
        {type: NotificationType.USER_INITIAL_TIPS},
        {type: NotificationType.USER_CLAIM_TIPS},
        {type: NotificationType.USER_TIPS},
      ],
    });

    console.log(
      'notification related to tipping have been successfully removed',
    );

    await currencyRepository.deleteAll();
    await currencyRepository.create({
      id: DefaultCurrencyType.MYRIA,
      decimal: 18,
      image:
        'https://pbs.twimg.com/profile_images/1407599051579617281/-jHXi6y5_400x400.jpg',
      rpcURL: config.MYRIAD_RPC_WS_URL,
      native: true,
      networkType: 'substrate',
      exchangeRate: false,
    });

    console.log('currency have been successfully removed except MYRIA');

    await userSocMedRepository.deleteAll();

    console.log('user social media have been successfully removed');
  }

  async doChangeBaseStorageURL(): Promise<void> {
    if (!this.options.environment) return;
    const environment = this.options.environment;

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
    const newBaseStorageURL = baseStorageURL[environment];

    if (!newBaseStorageURL) return;

    const oldStorageURL: string[] = [];

    const regexp = new RegExp(oldStorageURL.join('|'), 'i');

    for (const property in baseStorageURL) {
      if (property !== environment) {
        await userRepository.dataSource.connector
          .collection(User.modelName)
          .updateMany(
            {
              $or: [
                {profilePictureURL: {$regex: regexp}},
                {bannerImageUrl: {$regex: regexp}},
              ],
            },
            [
              {
                $set: {
                  bannerImageUrl: {
                    $replaceAll: {
                      input: '$bannerImageUrl',
                      find: baseStorageURL[property],
                      replacement: newBaseStorageURL,
                    },
                  },
                  profilePictureURL: {
                    $replaceAll: {
                      input: '$profilePictureURL',
                      find: baseStorageURL[property],
                      replacement: newBaseStorageURL,
                    },
                  },
                },
              },
            ],
          );

        await currencyRepository.dataSource.connector
          .collection(Currency.modelName)
          .updateMany({image: {$regex: regexp}}, [
            {
              $set: {
                image: {
                  $replaceAll: {
                    input: '$image',
                    find: baseStorageURL[property],
                    replacement: newBaseStorageURL,
                  },
                },
              },
            },
          ]);

        await experienceRepository.dataSource.connector
          .collection(Experience.modelName)
          .updateMany({experienceImageURL: {$regex: regexp}}, [
            {
              $set: {
                experienceImageURL: {
                  $replaceAll: {
                    input: '$experienceImageURL',
                    find: baseStorageURL[property],
                    replacement: newBaseStorageURL,
                  },
                },
              },
            },
          ]);

        await postRepository.dataSource.connector
          .collection(Post.modelName)
          .updateMany({text: {$regex: regexp}}, [
            {
              $set: {
                text: {
                  $replaceAll: {
                    input: '$text',
                    find: baseStorageURL[property],
                    replacement: newBaseStorageURL,
                  },
                },
              },
            },
          ]);
      }
    }

    console.log('image has been succesfully updated');
  }

  async doUpdatePeopleWallet(): Promise<void> {
    if (this.options.alter.indexOf('wallet') === -1) return;
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

    const {count} = await peopleRepository.count();

    for (let i = 0; i < count; i++) {
      const [people] = await peopleRepository.find({
        limit: 1,
        skip: i,
      });

      const platform = people.platform;

      if (platform === PlatformType.REDDIT) {
        try {
          const {data: user} = await redditService.getActions(
            'user/' + people.username + '/about.json',
          );

          const updatedPeople = new People({
            name: user.subreddit.title ? user.subreddit.title : user.name,
            username: user.name,
            originUserId: 't2_' + user.id,
            profilePictureURL: user.icon_img.split('?')[0],
          });

          return await peopleRepository.updateById(people.id, updatedPeople);
        } catch {
          // ignore
        }
      }

      if (platform === PlatformType.TWITTER) {
        try {
          const {user} = await twitterService.getActions(
            `1.1/statuses/show.json?id=${people.originUserId}&include_entities=true&tweet_mode=extended`,
          );

          const updatedPeople = new People({
            name: user.name,
            username: user.screen_name,
            originUserId: user.id_str,
            profilePictureURL: user.profile_image_url_https || '',
          });

          return await peopleRepository.updateById(people.id, updatedPeople);
        } catch {
          // ignore
        }
      }
    }
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
    const notificationRepository = await this.getRepository(
      NotificationRepository,
    );
    const notificationSettingRepository = await this.getRepository(
      NotificationSettingRepository,
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

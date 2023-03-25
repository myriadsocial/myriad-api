import {AuthenticationComponent} from '@loopback/authentication';
import {BootMixin} from '@loopback/boot';
import {ApplicationConfig, createBindingFromClass} from '@loopback/core';
import {CronComponent} from '@loopback/cron';
import {HealthComponent} from '@loopback/health';
import {
  AnyObject,
  RepositoryMixin,
  SchemaMigrationOptions,
} from '@loopback/repository';
import {Request, Response, RestApplication} from '@loopback/rest';
import {RestExplorerComponent} from '@loopback/rest-explorer';
import {ServiceMixin} from '@loopback/service-proxy';
import * as Sentry from '@sentry/node';
import * as firebaseAdmin from 'firebase-admin';
import {omit} from 'lodash';
import {
  RateLimiterComponent,
  RateLimitSecurityBindings,
} from 'loopback4-ratelimiter';
import multer from 'multer';
import path from 'path';
import {v4 as uuid} from 'uuid';
import {JWTAuthenticationComponent} from './components';
import {config} from './config';
import {FILE_UPLOAD_SERVICE} from './keys';
import {
  AccountSettingRepository,
  ActivityLogRepository,
  CommentRepository,
  CurrencyRepository,
  DraftPostRepository,
  ExperiencePostRepository,
  ExperienceRepository,
  ExperienceUserRepository,
  FriendRepository,
  LanguageSettingRepository,
  NetworkRepository,
  NotificationRepository,
  NotificationSettingRepository,
  PeopleRepository,
  PostRepository,
  ReportRepository,
  ServerRepository,
  TagRepository,
  TimelineConfigRepository,
  TransactionRepository,
  UserCurrencyRepository,
  UserExperienceRepository,
  UserReportRepository,
  UserRepository,
  UserSocialMediaRepository,
  VoteRepository,
  WalletRepository,
} from './repositories';
import {MyriadSequence} from './sequence';
import {
  ActivityLogService,
  AdminService,
  AuthService,
  CurrencyService,
  EmailService,
  ExperienceService,
  FCMService,
  FilterBuilderService,
  FriendService,
  MetricService,
  NetworkService,
  NotificationService,
  PeopleService,
  PostService,
  ReportService,
  ServerService,
  SocialMediaService,
  StatisticService,
  StorageService,
  TagService,
  TransactionService,
  UploadType,
  UserExperienceService,
  UserService,
  UserSocialMediaService,
  VoteService,
  WalletAddressService,
} from './services';
import {PolkadotJs} from './utils/polkadot-js';
import {getFilePathFromSeedData, upload} from './utils/upload';
import fs, {existsSync} from 'fs';
import {FriendStatusType} from './enums';
import {UpdatePeopleProfileJob} from './jobs';
import {SelectedUser, TimelineConfig} from './models';

const jwt = require('jsonwebtoken');

export {ApplicationConfig};

/* eslint-disable  @typescript-eslint/naming-convention */
export class MyriadApiApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    // Set up default home page
    this.static('/', path.join(__dirname, '../public'));
    // Set up local storages
    this.static('/storages', path.join(__dirname, '../storages'));
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
  }

  registerComponent() {
    this.component(HealthComponent);
    this.component(CronComponent);
    this.component(AuthenticationComponent);
    this.component(JWTAuthenticationComponent);
    this.component(RestExplorerComponent);

    if (this.options.test) return;
    if (config.REDIS_CONNECTOR !== 'kv-redis') return;

    this.component(RateLimiterComponent);
    this.bind(RateLimitSecurityBindings.CONFIG).to({
      name: 'redis',
      type: 'RedisStore',
      windowMs: 15 * 60 * 1000,
      standardHeaders: true,
      max: (req: Request, _: Response) => {
        switch (req.method) {
          case 'GET':
            return 900;

          case 'POST':
            return 50;

          case 'PATCH':
            return 50;

          case 'DELETE':
            return 50;

          default:
            return 900;
        }
      },
      keyGenerator: (req: Request, _: Response) => {
        const token = req.headers?.authorization?.replace(/bearer /i, '');
        const decryptedToken = token
          ? jwt.verify(token, config.JWT_TOKEN_SECRET_KEY)
          : undefined;
        const keyId = decryptedToken?.id ?? req.ip;
        const key = `${req.method}${req.path}/${keyId}`;

        return key;
      },
      handler: (_: Request, res: Response) => {
        res.status(429).send({
          error: {
            statusCode: 429,
            name: 'TooManyRequestsError',
            message: 'Too many request, please try again later',
          },
        });
      },
      skipFailedRequests: true,
    });
  }

  registerService() {
    this.service(ActivityLogService);
    this.service(AdminService);
    this.service(AuthService);
    this.service(CurrencyService);
    this.service(EmailService);
    this.service(ExperienceService);
    this.service(FilterBuilderService);
    this.service(FriendService);
    this.service(MetricService);
    this.service(NetworkService);
    this.service(NotificationService);
    this.service(PeopleService);
    this.service(PostService);
    this.service(ReportService);
    this.service(ServerService);
    this.service(SocialMediaService);
    this.service(StatisticService);
    this.service(StorageService);
    this.service(TagService);
    this.service(TransactionService);
    this.service(UserExperienceService);
    this.service(UserService);
    this.service(UserSocialMediaService);
    this.service(VoteService);
    this.service(WalletAddressService);

    // 3rd party service
    this.service(FCMService);
  }

  registerJob() {
    this.add(createBindingFromClass(UpdatePeopleProfileJob));
  }

  configureFileUpload() {
    if (this.options.test) return;
    const multerOptions: multer.Options = {
      storage: multer.diskStorage({
        filename: (_, file, cb) => {
          cb(null, `${uuid()}${path.extname(file.originalname)}`);
        },
      }),
    };
    // Configure the file upload service with multer options
    this.configure(FILE_UPLOAD_SERVICE).to(multerOptions);
  }

  configureFirebase() {
    if (this.options.test || !config.FIREBASE_STORAGE_BUCKET) return;
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
    const env = this.options?.environment;
    if (!this.options?.skipMigrateSchema) await super.migrateSchema(options);
    if (options?.existingSchema === 'drop') return this.databaseSeeding(env);
    await Promise.all([this.doMigrateExperience()]);
  }

  async databaseSeeding(environment: string): Promise<void> {
    const directory = path.join(__dirname, `../seed-data/${environment}`);

    if (!existsSync(directory)) return;

    const {
      currencyRepository,
      friendRepository,
      networkRepository,
      serverRepository,
      userRepository,
      userCurrencyRepository,
      walletRepository,
    } = await this.repositories();

    const bar = this.initializeProgressBar('Start Seeding');
    const files = fs.readdirSync(directory);
    const barSize = files.length + 1;

    bar.start(barSize, 0);
    for (const [index, file] of files.entries()) {
      if (file.endsWith('.json')) {
        const dataDirectory = path.join(directory, file);
        const stringifyJSON = fs.readFileSync(dataDirectory, 'utf-8');
        const data = JSON.parse(stringifyJSON);

        switch (file) {
          case 'default-network-currencies.json':
          case 'network-currencies.json': {
            await Promise.all(
              data.map(async (networkCurrency: AnyObject) => {
                const {network, currencies} = networkCurrency;
                const filePath = getFilePathFromSeedData(
                  network.sourceImageFileName,
                );
                const targetDir = `general/networks/${network.id}`;
                const networkImageURL = await upload(
                  UploadType.IMAGE,
                  targetDir,
                  filePath,
                );

                if (!networkImageURL) return;

                const rawNetwork = Object.assign(
                  omit(network, ['sourceImageFileName']),
                  {
                    image: networkImageURL,
                  },
                );

                const updatedCurrencies = await Promise.all(
                  currencies.map(async (currency: AnyObject) => {
                    const sourceImageFileName = currency.sourceImageFileName;
                    const currencyFilePath =
                      getFilePathFromSeedData(sourceImageFileName);
                    const currencyTargetDir = `general/currencies/${currency.name}`;
                    const currencyImageURL = await upload(
                      UploadType.IMAGE,
                      currencyTargetDir,
                      currencyFilePath,
                    );

                    if (!currencyImageURL) return;

                    return Object.assign(
                      omit(currency, ['sourceImageFileName']),
                      {
                        image: currencyImageURL,
                        networkId: rawNetwork.id,
                      },
                    );
                  }),
                );

                const rawCurrencies = updatedCurrencies.filter(
                  e => e !== undefined,
                );

                if (currencies.length === 0) return;

                await currencyRepository.createAll(rawCurrencies);
                await networkRepository.create(rawNetwork);
              }),
            );
            break;
          }

          case 'default-user-wallet.json':
          case 'user-wallet.json': {
            const wallets = await Promise.all(
              data.map(async (e: AnyObject) => {
                const {user, wallet} = e;
                const rawUser = omit(user, ['sourceImageFileName']);

                if (user.username === 'myriad_official') {
                  Object.assign(rawUser, {
                    verified: true,
                    bio: 'A social metaverse & metasocial network on web3, pulling content from mainstream social media and turning every post into a tipping wallet.',
                    websiteURL: 'https://myriad.social',
                  });
                }

                const {id} = await userRepository.create(rawUser);
                const filePath = getFilePathFromSeedData(
                  user.sourceImageFileName,
                );
                const targetDir = `users/${id}/image`;
                const profilePictureURL = await upload(
                  UploadType.IMAGE,
                  targetDir,
                  filePath,
                );

                await userRepository.updateById(id, {profilePictureURL});

                Object.assign(wallet, {primary: true});

                return userRepository.wallets(id).create(wallet);
              }),
            );

            const myriadWalletAddress =
              environment === 'mainnet'
                ? '0xecfeabd53afba60983271c8fc13c133ae7e904ba90a7c5dee1f43523559fee5f'
                : '0x22968e3881c9eb2625cf0d85a05f7d7ea4b542f000821ab185ce978b6da6081b';
            const myriadWallet = wallets.find(e => {
              return e.id === myriadWalletAddress;
            });
            const promises = [];
            for (const wallet of wallets) {
              const userId = wallet.userId;
              const networkId = wallet.networkId;
              const [exists, currencies] = await Promise.all([
                networkRepository.exists(networkId),
                currencyRepository.find({
                  where: {networkId},
                  order: ['native DESC'],
                }),
              ]);

              if (currencies.length === 0 || !exists) {
                await Promise.all([
                  userRepository.deleteAll(),
                  currencyRepository.deleteAll(),
                  walletRepository.deleteAll(),
                  serverRepository.deleteAll(),
                ]);

                throw new Error('Currency/Network Not Found');
              }

              if (myriadWallet && userId !== myriadWallet.userId) {
                promises.push(
                  friendRepository.create({
                    status: FriendStatusType.APPROVED,
                    requestorId: userId,
                    requesteeId: myriadWallet.userId,
                  }),
                );
              }

              promises.push(
                userRepository.accountSetting(userId).create({}),
                userRepository.notificationSetting(userId).create({}),
                userRepository.languageSetting(userId).create({}),
                currencies.map((currency: AnyObject, idx: number) =>
                  userCurrencyRepository.create({
                    currencyId: currency.id,
                    networkId,
                    userId,
                    priority: idx + 1,
                  }),
                ),
              );
            }

            await Promise.allSettled(promises);

            break;
          }

          default:
            return;
        }
      }

      bar.update(index);
    }

    const name = config.DOMAIN.trim();
    if (!name) {
      await Promise.all([
        userRepository.deleteAll(),
        currencyRepository.deleteAll(),
        walletRepository.deleteAll(),
        serverRepository.deleteAll(),
      ]);

      throw new Error('DomainNotFound');
    }
    const description = 'My Instance';
    const categories = ['general'];

    const mnemonic = config.MYRIAD_ADMIN_SUBSTRATE_MNEMONIC;
    if (!mnemonic) {
      await Promise.all([
        userRepository.deleteAll(),
        currencyRepository.deleteAll(),
        walletRepository.deleteAll(),
        serverRepository.deleteAll(),
      ]);

      throw new Error('MnemonicNotFound');
    }
    const {getKeyring} = new PolkadotJs();
    const substrateAdmin = getKeyring().addFromMnemonic(mnemonic);

    const filePathProfile = getFilePathFromSeedData('myriad_circle');
    const filePathBanner = getFilePathFromSeedData('myriad_with_text');
    const targetDir = 'general/servers';
    const [profileImageURL, bannerImageURL] = await Promise.all([
      upload(UploadType.IMAGE, targetDir, filePathProfile),
      upload(UploadType.IMAGE, targetDir, filePathBanner),
    ]);
    if (!profileImageURL || !bannerImageURL) {
      await Promise.all([
        userRepository.deleteAll(),
        currencyRepository.deleteAll(),
        walletRepository.deleteAll(),
        serverRepository.deleteAll(),
      ]);

      throw new Error('ImageNotFound');
    }

    const rawServer = Object.assign({
      id: 0,
      name: name,
      description: description,
      categories: categories,
      serverImageURL: profileImageURL, // TODO: remove
      images: {
        logo_banner: bannerImageURL, // TODO: remove
        profile: profileImageURL,
        banner: bannerImageURL,
      },
      accountId: {
        myriad: substrateAdmin.address,
      },
    });
    await serverRepository.create(rawServer);

    bar.update(barSize);
    bar.stop();
  }

  async doMigrateExperience(): Promise<void> {
    if (!this.doCollectionExists('experience')) return;
    const {
      experienceRepository,
      experiencePostRepository,
      postRepository,
      userExperienceRepository,
      timelineConfigRepository,
    } = await this.repositories();
    const {count: totalExperience} = await experienceRepository.count({
      selectedUserIds: {
        exists: true,
      },
    });

    const bar1 = this.initializeProgressBar('Start Migrate Experience');
    const promises = [];

    bar1.start(totalExperience - 1);
    for (let i = 0; i < totalExperience; i++) {
      const [experience] = await experienceRepository.find({
        limit: 1,
        skip: i,
        where: {
          selectedUserIds: {
            exists: true,
          },
        },
      });

      if (experience.selectedUserIds.length === 0) continue;
      const selectedUserIds: SelectedUser[] = [];
      for (const selected of experience.selectedUserIds) {
        const stringify = JSON.stringify(selected);
        try {
          const obj = JSON.parse(stringify);

          let data: SelectedUser;

          if (typeof obj === 'string') {
            data = {
              userId: obj,
              addedAt: 0,
            };
          } else {
            data = obj;
          }

          selectedUserIds.push(data);
        } catch {
          // ignore
        }
      }

      promises.push(
        experienceRepository.updateById(experience.id, {
          selectedUserIds,
        }),
      );

      bar1.update(i + 1);
    }

    bar1.stop();

    const {count: totalPostExp} = await experiencePostRepository.count();
    const bar2 = this.initializeProgressBar('Start Migrate Experience Post');

    bar2.start(totalPostExp - 1);
    for (let i = 0; i < totalPostExp; i++) {
      const [experiencePost] = await experiencePostRepository.find({
        limit: 1,
        skip: i,
      });

      if (!experiencePost) continue;
      const {id, experienceId, postId} = experiencePost;
      const post = await postRepository.findOne({
        where: {
          id: postId,
        },
      });

      if (!post) {
        promises.push(experiencePostRepository.deleteById(id));
      } else {
        const experience = await experienceRepository.findOne({
          where: {
            id: experienceId,
          },
        });

        if (!experience) {
          promises.push(experiencePostRepository.deleteById(id));
        } else {
          post.addedAt = post?.addedAt ?? {};
          post.addedAt[experienceId] = 0;
          promises.push(
            postRepository.updateById(postId, {
              addedAt: post.addedAt,
            }),
          );
        }
      }

      bar2.update(i + 1);
    }

    bar2.stop();

    const {count: totalUserExperience} = await userExperienceRepository.count();
    const bar3 = this.initializeProgressBar('Start Migrate Timeline Config');
    const configs = new Map<string, TimelineConfig>();

    bar3.start(totalExperience - 1);
    for (let i = 0; i < totalUserExperience; i++) {
      const [userExperience] = await userExperienceRepository.find({
        limit: 1,
        skip: i,
        include: [
          {
            relation: 'experience',
            scope: {
              include: [{relation: 'users'}],
            },
          },
        ],
      });

      if (!userExperience) continue;
      const experience = userExperience.experience;
      if (!experience) continue;
      const users = experience.users ?? [];
      const timelineConfig = await (configs.get(userExperience.userId) ??
        timelineConfigRepository
          .findOne({
            where: {userId: userExperience.userId},
          })
          .then(result => {
            if (result) return result;
            return timelineConfigRepository.create({
              userId: userExperience.userId,
            });
          }));

      timelineConfig.data[experience.id] = {
        timelineId: experience.id,
        allowedTags: experience.allowedTags,
        prohibitedTags: experience.prohibitedTags,
        peopleIds: experience.people.map(e => e.id),
        userIds: users.map(e => e.id),
        selectedUserIds: experience.selectedUserIds,
        visibility: experience.visibility,
        createdBy: experience.createdBy,
        createdAt: 0,
      };

      configs.set(userExperience.userId, timelineConfig);

      bar3.update(i + 1);
    }

    configs.forEach(value => {
      promises.push(timelineConfigRepository.update(value));
    });

    bar3.stop();

    await Promise.allSettled(promises);
  }

  async repositories(): Promise<Repositories> {
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
    const experiencePostRepository = await this.getRepository(
      ExperiencePostRepository,
    );
    const friendRepository = await this.getRepository(FriendRepository);
    const languageSettingRepository = await this.getRepository(
      LanguageSettingRepository,
    );
    const networkRepository = await this.getRepository(NetworkRepository);
    const notificationRepository = await this.getRepository(
      NotificationRepository,
    );
    const notificationSettingRepository = await this.getRepository(
      NotificationSettingRepository,
    );
    const peopleRepository = await this.getRepository(PeopleRepository);
    const postRepository = await this.getRepository(PostRepository);
    const reportRepository = await this.getRepository(ReportRepository);
    const serverRepository = await this.getRepository(ServerRepository);
    const tagRepository = await this.getRepository(TagRepository);
    const timelineConfigRepository = await this.getRepository(
      TimelineConfigRepository,
    );
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
    const walletRepository = await this.getRepository(WalletRepository);

    return {
      accountSettingRepository,
      activityLogRepository,
      commentRepository,
      currencyRepository,
      draftPostRepository,
      experiencePostRepository,
      experienceUserRepository,
      experienceRepository,
      friendRepository,
      languageSettingRepository,
      networkRepository,
      notificationRepository,
      notificationSettingRepository,
      peopleRepository,
      postRepository,
      reportRepository,
      serverRepository,
      tagRepository,
      timelineConfigRepository,
      transactionRepository,
      userRepository,
      userCurrencyRepository,
      userExperienceRepository,
      userReportRepository,
      userSocMedRepository,
      voteRepository,
      walletRepository,
    };
  }

  doCollectionExists(name: string) {
    return this.options.alter.length > 0 && this.options.alter.includes(name);
  }

  initializeProgressBar(title: string) {
    const cliProgress = require('cli-progress');
    const colors = require('ansi-colors');

    return new cliProgress.Bar({
      format:
        `${title} |` +
        colors.blue('{bar}') +
        '| {percentage}% || {value}/{total}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      synchronousUpdate: true,
    });
  }
}

interface Repositories {
  accountSettingRepository: AccountSettingRepository;
  activityLogRepository: ActivityLogRepository;
  commentRepository: CommentRepository;
  currencyRepository: CurrencyRepository;
  draftPostRepository: DraftPostRepository;
  experiencePostRepository: ExperiencePostRepository;
  experienceUserRepository: ExperienceUserRepository;
  experienceRepository: ExperienceRepository;
  friendRepository: FriendRepository;
  languageSettingRepository: LanguageSettingRepository;
  networkRepository: NetworkRepository;
  notificationRepository: NotificationRepository;
  notificationSettingRepository: NotificationSettingRepository;
  peopleRepository: PeopleRepository;
  postRepository: PostRepository;
  reportRepository: ReportRepository;
  serverRepository: ServerRepository;
  tagRepository: TagRepository;
  timelineConfigRepository: TimelineConfigRepository;
  transactionRepository: TransactionRepository;
  userRepository: UserRepository;
  userCurrencyRepository: UserCurrencyRepository;
  userExperienceRepository: UserExperienceRepository;
  userReportRepository: UserReportRepository;
  userSocMedRepository: UserSocialMediaRepository;
  voteRepository: VoteRepository;
  walletRepository: WalletRepository;
}

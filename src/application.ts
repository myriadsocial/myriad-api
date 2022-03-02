import {AuthenticationComponent} from '@loopback/authentication';
import {BootMixin} from '@loopback/boot';
import {ApplicationConfig, createBindingFromClass} from '@loopback/core';
import {HealthComponent} from '@loopback/health';
import {
  AnyObject,
  RepositoryMixin,
  SchemaMigrationOptions,
} from '@loopback/repository';
import {RestApplication, Request, Response} from '@loopback/rest';
import {RestExplorerComponent} from '@loopback/rest-explorer';
import {ServiceMixin} from '@loopback/service-proxy';
import * as firebaseAdmin from 'firebase-admin';
import {config} from './config';
import path from 'path';
import {JWTAuthenticationComponent} from './components';
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
  VoteService,
} from './services';
import {UpdateExchangeRateJob, UpdatePeopleProfileJob} from './jobs';
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
  ExperienceRepository,
  ExperienceUserRepository,
  FriendRepository,
  NotificationRepository,
  NotificationSettingRepository,
  PeopleRepository,
  PostRepository,
  TagRepository,
  TransactionRepository,
  UserCurrencyRepository,
  UserExperienceRepository,
  UserReportRepository,
  UserRepository,
  UserSocialMediaRepository,
  VoteRepository,
} from './repositories';
import {
  NotificationType,
  ReferenceType,
  PermissionKeys,
  DefaultCurrencyType,
  FriendStatusType,
  ActivityLogType,
} from './enums';
import {
  RateLimiterComponent,
  RateLimitSecurityBindings,
} from 'loopback4-ratelimiter';
import {DateUtils} from './utils/date-utils';
import {MentionUser, Post} from './models';
import {decodeAddress} from '@polkadot/util-crypto';
import {u8aToHex} from '@polkadot/util';
import NonceGenerator from 'a-nonce-generator';

const date = new DateUtils();
const jwt = require('jsonwebtoken');

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
    this.component(RestExplorerComponent);

    if (this.options.test) return;
    if (config.REDIS_CONNECTOR !== 'kv-redis') return;
    this.component(RateLimiterComponent);
    this.bind(RateLimitSecurityBindings.CONFIG).to({
      name: 'redis',
      type: 'RedisStore',
      windowMs: 15 * date.minute,
      max: (req: Request, res: Response) => {
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
      keyGenerator: (req: Request, res: Response) => {
        const token = req.headers?.authorization?.replace(/bearer /i, '');
        const decryptedToken = token
          ? jwt.verify(token, config.JWT_TOKEN_SECRET_KEY)
          : undefined;
        const keyId = decryptedToken?.id ?? req.ip;
        const key = `${req.method}${req.path}/${keyId}`;

        return key;
      },
      handler: (req: Request, res: Response) => {
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
    this.service(VoteService);

    // 3rd party service
    this.service(FCMService);
    this.service(FCSService);
  }

  registerJob() {
    this.add(createBindingFromClass(UpdateExchangeRateJob));
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
    await super.migrateSchema(options);

    if (options?.existingSchema === 'alter') {
      await this.doMigratePost();
      await this.doMigrateNotification();
      await this.doUpdateMention();
      await this.doMigrateUser();
      await this.doMigrateCurrency();
      return;
    }
  }

  async doMigratePost(): Promise<void> {
    if (this.options.alter.indexOf('post') === -1) return;
    const {postRepository, transactionRepository} = await this.repositories();

    await postRepository.updateAll({banned: false});

    const {count} = await postRepository.count();
    const bar = this.initializeProgressBar('Alter post');

    bar.start(count, 0);
    for (let i = 0; i < count; i++) {
      bar.update(i + 1);

      const [post] = await postRepository.find({
        limit: 1,
        skip: i,
      });

      if (!post) continue;
      const {id, metric} = post;
      const {count: countTip} = await transactionRepository.count({
        referenceId: id,
        type: ReferenceType.POST,
      });

      await postRepository.updateById(id, {
        metric: {
          ...metric,
          tips: countTip,
        },
      });
    }
    bar.stop();
  }

  async doMigrateNotification(): Promise<void> {
    if (this.options.alter.indexOf('notification') === -1) return;
    const {
      commentRepository,
      notificationRepository,
      peopleRepository,
      postRepository,
      transactionRepository,
      userRepository,
    } = await this.repositories();
    const {count} = await notificationRepository.count();
    const bar = this.initializeProgressBar('Alter notification');
    const notificationIds: string[] = [];

    bar.start(count, 0);
    for (let i = 0; i < count; i++) {
      bar.update(i + 1);

      try {
        const [notification] = await notificationRepository.find({
          limit: 1,
          skip: i,
        });

        if (!notification) continue;

        const type = notification.type;
        const referenceId = notification.referenceId;
        const additionalReferenceId = notification.additionalReferenceId;

        switch (type) {
          case NotificationType.CONNECTED_SOCIAL_MEDIA:
          case NotificationType.DISCONNECTED_SOCIAL_MEDIA: {
            const people = await peopleRepository.findOne({
              where: {
                id: additionalReferenceId[0].peopleId,
              },
            });

            if (!people) {
              notificationIds.push(notification.id);
              continue;
            }

            notification.additionalReferenceId = {
              people: {
                id: people.id,
                name: people.name,
                username: people.username,
                platform: people.platform,
              },
            };

            break;
          }

          case NotificationType.USER_BANNED:
          case NotificationType.POST_REMOVED:
          case NotificationType.COMMENT_REMOVED: {
            if (type === NotificationType.USER_BANNED) {
              const user = await userRepository.findOne({
                where: {
                  id: referenceId,
                },
              });

              if (!user) {
                notificationIds.push(notification.id);
                continue;
              }

              notification.additionalReferenceId = {
                user: {
                  id: user.id,
                  name: user.name,
                  username: user.username,
                },
              };
            } else if (type === NotificationType.POST_REMOVED) {
              const post = await postRepository.findOne({
                where: {
                  id: referenceId,
                },
                include: ['user'],
              });

              if (!post) {
                notificationIds.push(notification.id);
                continue;
              }

              notification.additionalReferenceId = {
                post: {
                  id: post.id,
                  user: {
                    id: post.user?.id,
                    name: post.user?.name,
                    username: post.user?.username,
                  },
                },
              };
            } else {
              const comment = await commentRepository.findOne({
                where: {
                  id: referenceId,
                },
                include: ['user'],
              });

              if (!comment) {
                notificationIds.push(notification.id);
                continue;
              }

              notification.additionalReferenceId = {
                comment: {
                  id: comment.id,
                  postId: comment.postId,
                  user: {
                    id: comment.user?.id,
                    name: comment.user?.name,
                    username: comment.user?.username,
                  },
                },
              };
            }

            break;
          }

          case NotificationType.POST_COMMENT:
          case NotificationType.COMMENT_COMMENT: {
            const comment = await commentRepository.findOne({
              where: {
                id: referenceId,
              },
              include: ['user'],
            });

            if (!comment) {
              notificationIds.push(notification.id);
              continue;
            }

            notification.additionalReferenceId = {
              comment: {
                id: comment.id,
                postId: comment.postId,
                user: {
                  id: comment.user.id,
                  name: comment.user.name,
                  username: comment.user.username,
                },
              },
            };

            break;
          }

          case NotificationType.POST_TIPS:
          case NotificationType.COMMENT_TIPS: {
            const transaction = await transactionRepository.findOne({
              where: {
                id: referenceId,
              },
            });
            if (!transaction) {
              notificationIds.push(notification.id);
              continue;
            }
            if (
              transaction.type === ReferenceType.POST ||
              transaction.type === ReferenceType.COMMENT
            ) {
              if (!referenceId) {
                if (transaction.type === ReferenceType.COMMENT) {
                  await transaction.updateById(transaction.id, {
                    $unset: {
                      type: '',
                    },
                  });
                } else {
                  notificationIds.push(notification.id);
                  await transactionRepository.deleteById(transaction.id);
                }
                continue;
              }
            }

            if (transaction.type === ReferenceType.POST) {
              const post = await postRepository.findOne({
                where: {
                  id: transaction.referenceId,
                },
                include: ['user'],
              });

              if (!post) {
                notificationIds.push(notification.id);
                continue;
              }

              notification.additionalReferenceId = {
                post: {
                  id: post.id,
                  user: {
                    id: post.user?.id,
                    name: post.user?.name,
                    username: post.user?.username,
                  },
                },
              };
            } else {
              const comment = await commentRepository.findOne({
                where: {
                  id: transaction.referenceId,
                },
                include: ['user'],
              });

              if (!comment) {
                notificationIds.push(notification.id);
                continue;
              }

              notification.additionalReferenceId = {
                comment: {
                  id: comment.id,
                  postId: comment.postId,
                  user: {
                    id: comment.user?.id,
                    name: comment.user?.name,
                    username: comment.user?.username,
                  },
                },
              };
            }

            break;
          }

          case NotificationType.POST_MENTION:
          case NotificationType.COMMENT_MENTION: {
            if (type === NotificationType.POST_MENTION) {
              const post = await postRepository.findOne({
                where: {
                  id: referenceId,
                },
                include: ['user'],
              });

              if (!post) {
                notificationIds.push(notification.id);
                continue;
              }

              notification.additionalReferenceId = {
                post: {
                  id: post.id,
                  user: {
                    id: post.user.id,
                    name: post.user.name,
                    username: post.user.username,
                  },
                },
              };
            } else {
              const comment = await commentRepository.findOne({
                where: {
                  id: referenceId,
                },
                include: ['user'],
              });

              if (!comment) {
                notificationIds.push(notification.id);
                continue;
              }

              notification.additionalReferenceId = {
                comment: {
                  id: comment.id,
                  postId: comment.postId,
                  user: {
                    id: comment.user?.id,
                    name: comment.user?.name,
                    username: comment.user?.username,
                  },
                },
              };
            }

            break;
          }
        }

        await notificationRepository.updateById(notification.id, {
          additionalReferenceId: notification.additionalReferenceId,
        });
      } catch {
        // ignore
      }
    }

    await notificationRepository.deleteAll({
      id: {inq: notificationIds},
    });

    bar.stop();
  }

  async doUpdateMention(): Promise<void> {
    if (this.options.alter.indexOf('mention') === -1) return;
    const {postRepository, userRepository} = await this.repositories();
    const {count} = await userRepository.count();
    const bar = this.initializeProgressBar('Alter mention');

    await postRepository.updateAll({mentions: []});

    bar.start(count + 1, 0);
    for (let i = 0; i < count; i++) {
      const [user] = await userRepository.find({
        limit: 1,
        skip: i,
      });

      if (!user) continue;
      const textMention = `"type":"mention","children":\\[{"text":""\\}],"value":"${user.id}"`;
      const posts = await postRepository.find({
        where: {
          text: {
            regexp: new RegExp(textMention, 'i'),
          },
        },
      });

      if (posts.length === 0) continue;
      await Promise.all(
        posts.map(async (post: Post) => {
          post.mentions.push(
            new MentionUser({
              id: user.id,
              name: user.name,
              username: user.username,
            }),
          );

          return postRepository.updateById(post.id, {mentions: post.mentions});
        }),
      );
      bar.update(i + 1);
    }

    const user = await userRepository.findOne({
      where: {username: 'myriad_official'},
    });

    if (user) {
      const myriadMention = new RegExp(
        '"type":"mention","children":\\[{"text":""\\}],"value":"' +
          '.*' +
          '","name":"Myriad Official"',
        'i',
      );
      const replaceMention = `"type":"mention","children":[{"text":""}],"value":"${user.id}","name":"Myriad Official"`;
      const myriadPost = await postRepository.find({
        where: {
          text: {
            regexp: new RegExp(myriadMention, 'i'),
          },
        },
      });

      await Promise.all(
        myriadPost.map(async (post: Post) => {
          post.mentions.push(
            new MentionUser({
              id: user.id,
              name: user.name,
              username: user.username,
            }),
          );
          post.text = post.text?.replace(myriadMention, replaceMention);
          return postRepository.updateById(post.id, {
            mentions: post.mentions,
            text: post.text,
          });
        }),
      );
    }
    bar.update(count + 1);
    bar.stop();
  }

  async doMigrateUser() {
    if (this.options.alter.indexOf('user') === -1) return;
    const {
      activityLogRepository,
      userRepository,
      friendRepository,
      userCurrencyRepository,
    } = await this.repositories();

    await userRepository.updateAll({verified: false});
    await userRepository.updateAll(
      {verified: true},
      {id: config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY},
    );
    const user = await (userRepository as UserRepository).create({
      id: u8aToHex(
        decodeAddress('1x8aa2N2Ar9SQweJv9vsuZn3WYDHu7gMQu1RePjZuBe33Hv'),
      ),
      name: 'Ukraine / Україна',
      username: 'ukraine',
      profilePictureURL:
        'https://pbs.twimg.com/profile_images/1011852346232631296/gw8Yp3dG_400x400.jpg',
      bannerImageUrl:
        'https://pbs.twimg.com/profile_banners/732521058507620356/1625634206/1500x500',
      bio: 'Yes, this is the official Myriad account of Ukraine. Nice pics: #BeautifulUkraine⛰ Our music: #UkieBeats🎶',
      verified: true,
      fcmTokens: [],
      metric: {
        totalPosts: 0,
        totalKudos: 0,
        totalFriends: 1,
        totalExperiences: 0,
      },
      nonce: (() => {
        const ng = new NonceGenerator();
        return ng.generate();
      })(),
      defaultCurrency: DefaultCurrencyType.MYRIA,
      permissions: [PermissionKeys.USER],
      createdAt: new Date().toString(),
      updatedAt: new Date().toString(),
    });
    await userRepository.accountSetting(user.id).create({});
    await userRepository.notificationSetting(user.id).create({});
    await userRepository.languageSetting(user.id).create({});
    await friendRepository.create({
      status: FriendStatusType.APPROVED,
      requestorId: user.id,
      requesteeId: config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY,
    });
    await userCurrencyRepository.create({
      userId: user.id,
      currencyId: DefaultCurrencyType.MYRIA,
      priority: 1,
    });
    await activityLogRepository.create({
      type: ActivityLogType.NEWUSER,
      userId: user.id,
      referenceId: user.id,
      referenceType: ReferenceType.USER,
    });
  }

  async doMigrateCurrency() {
    if (this.options.alter.indexOf('currency') === -1) return;
    console.log('hello');
    const {currencyRepository} = await this.repositories();
    try {
      await currencyRepository.createAll([
        {
          id: 'DOT',
          image:
            'https://pbs.twimg.com/profile_images/1471096119182700550/KTxlFVah_400x400.jpg',
          decimal: 10,
          rpcURL: 'wss://rpc.polkadot.io',
          native: true,
          exchangeRate: true,
          networkType: 'substrate',
          explorerURL:
            'https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Frpc.polkadot.io#/explorer/query',
        },
        {
          id: 'KSM',
          image:
            'https://pbs.twimg.com/profile_images/1430157114194944000/72gTG-fc_400x400.jpg',
          decimal: 12,
          rpcURL: 'wss://kusama-rpc.polkadot.io',
          native: true,
          exchangeRate: true,
          networkType: 'substrate',
          explorerURL:
            'https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Fkusama-rpc.polkadot.io#/explorer/query',
        },
      ]);
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
    const tagRepository = await this.getRepository(TagRepository);
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
      tagRepository,
      transactionRepository,
      userRepository,
      userCurrencyRepository,
      userExperienceRepository,
      userReportRepository,
      userSocMedRepository,
      voteRepository,
    };
  }

  initializeProgressBar(title: string) {
    const cliProgress = require('cli-progress');
    const colors = require('ansi-colors');

    return new cliProgress.Bar({
      format:
        `${title} |` +
        colors.cyan('{bar}') +
        '| {percentage}% || ETA: {eta}s || {value}/{total} documents ',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      synchronousUpdate: true,
    });
  }
}

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
import {NotificationType, ReferenceType} from './enums';

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
      return;
    }
  }

  async doMigratePost(): Promise<void> {
    if (this.options.alter.indexOf('post') === -1) return;
    const {postRepository} = await this.repositories();

    await (postRepository as PostRepository).updateAll({banned: false});
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
                notificationIds.push(notification.id);
                await transactionRepository.deleteById(transaction.id);
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

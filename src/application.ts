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
import {PermissionKeys, PlatformType} from './enums';
import {MentionUser, Post, UserCurrency} from './models';

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
      await this.doMigrateUser();
      await this.doMigrateTag();
      await this.doMigrateUserCurrency();
      return;
    }
  }

  async doMigrateUser(): Promise<void> {
    if (this.options.alter.indexOf('user') === -1) return;
    const {postRepository, userRepository} = await this.repositories();

    await userRepository.updateAll({permissions: [PermissionKeys.USER]});
    await userRepository.updateAll(
      {
        permissions: [
          PermissionKeys.MASTER,
          PermissionKeys.ADMIN,
          PermissionKeys.USER,
        ],
      },
      {username: 'myriad_official'},
    );

    const {count} = await userRepository.count();
    const bar = this.initializeProgressBar('Alter mention user');

    bar.start(count - 1, 0);
    for (let i = 0; i < count; i++) {
      bar.update(i);

      const [user] = await userRepository.find({
        limit: 1,
        skip: i,
      });

      const re = new RegExp(
        `\"type\":\"mention\",\"children\":[{\"text\":\"\"}],\"value\":\"${user.id}\"`,
        'i',
      );
      const post = await postRepository.findOne({
        where: {
          text: {
            regexp: re,
          },
        },
      });
      if (!post) continue;
      const mentions = post.mentions as MentionUser[];
      const found = mentions.find(mention => mention.id === user.id);
      if (found) continue;
      mentions.push(
        new MentionUser({
          id: user.id,
          name: user.name,
          username: user.username,
        }),
      );
      await postRepository.updateById(post.id, {mentions});
    }

    bar.stop();
  }

  async doMigratePost(): Promise<void> {
    if (this.options.alter.indexOf('post') === -1) return;
    const {postRepository} = await this.repositories();
    const {count} = await postRepository.count();
    const bar = this.initializeProgressBar('Alter post');

    bar.start(count - 1, 0);
    for (let i = 0; i < count; i++) {
      bar.update(i);

      const [post] = await postRepository.find({
        limit: 1,
        skip: i,
      });

      const {platform, text, title, tags} = post;
      const data: Partial<Post> = {};

      if (tags.length > 0) {
        data.tags = tags.map((tag: string) => {
          return tag
            .toLowerCase()
            .replace(/ +/gi, '')
            .replace(/[^A-Za-z0-9]/gi, '')
            .trim();
        });
      }

      if (platform !== PlatformType.MYRIAD) {
        if (platform === PlatformType.REDDIT) {
          data.title = title
            .replace(/^("+)/, '')
            .replace(/("+)$/, '')
            .replace(new RegExp('&#x200B', 'ig'), '');
        }

        const removedQuote = text
          .replace(/^("+)/, '')
          .replace(/("+)$/, '')
          .replace(/&(amp;)*#x200B;*/, '')
          .trim();
        const socmedRawText = removedQuote
          .replace(/#\w+/gi, '')
          .replace(/\n/gi, ' ')
          .replace(/ +/gi, ' ')
          .trim();
        const rawText = data.title ?? '' + ' ' + socmedRawText;

        data.text = removedQuote;
        data.rawText = rawText.trim();
      } else {
        let myriadRawText = '';

        try {
          const nodes = JSON.parse(text);
          const renderElement = (node: AnyObject) => {
            if (node.text) {
              myriadRawText += node.text + ' ';
            }

            node?.children?.forEach((child: AnyObject) => renderElement(child));
          };

          nodes.forEach((node: AnyObject) => renderElement(node));

          data.rawText = myriadRawText
            .replace(/\,/gi, '')
            .replace(/ +/gi, ' ')
            .trim();
        } catch {
          data.rawText = text;
        }
      }

      await postRepository.updateById(post.id, data);
    }

    bar.stop();
  }

  async doMigrateTag(): Promise<void> {
    if (this.options.alter.indexOf('tag') === -1) return;
    const {postRepository, tagRepository} = await this.repositories();
    const {count} = await tagRepository.count();
    const bar = this.initializeProgressBar('Alter tag');

    bar.start(count - 1, 0);
    for (let i = 0; i < count; i++) {
      bar.update(i);

      const [tag] = await tagRepository.find({
        limit: 1,
        skip: i,
      });

      if (!tag) continue;
      if (!tag.id) continue;

      const tagId = tag.id;
      const newTag = Object.assign(tag, {
        id: tag.id
          .toLowerCase()
          .replace(/ +/gi, '')
          .replace(/[^A-Za-z0-9]/gi, '')
          .trim(),
      });

      try {
        await tagRepository.deleteById(tagId);

        const {count: countTag} = await postRepository.count({
          tags: {inq: [[newTag.id]]},
        });

        await tagRepository.create(Object.assign(newTag, {count: countTag}));
      } catch {
        // ignore
      }
    }
    bar.stop();
  }

  async doMigrateUserCurrency(): Promise<void> {
    if (this.options.alter.indexOf('currency') === -1) return;
    const {userRepository, userCurrencyRepository} = await this.repositories();
    const {count: countUser} = await userRepository.count();
    const bar = this.initializeProgressBar('Alter user currency');

    bar.start(countUser - 1, 0);
    for (let i = 0; i < countUser; i++) {
      bar.update(i);

      const [user] = await userRepository.find({
        limit: 1,
        skip: i,
      });

      const userCurrency = await userCurrencyRepository.find({
        where: {
          userId: user.id,
        },
      });

      await Promise.all(
        userCurrency.map(async (e: UserCurrency, index: number) => {
          return userCurrencyRepository.updateById(e.id, {
            priority: index + 1,
          });
        }),
      );
    }
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

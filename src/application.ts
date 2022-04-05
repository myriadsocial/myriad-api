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
  NetworkService,
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
  LanguageSettingRepository,
  NetworkRepository,
  NotificationRepository,
  NotificationSettingRepository,
  PeopleRepository,
  PostRepository,
  ReportRepository,
  TagRepository,
  TransactionRepository,
  UserCurrencyRepository,
  UserExperienceRepository,
  UserReportRepository,
  UserRepository,
  UserSocialMediaRepository,
  VoteRepository,
  WalletRepository,
} from './repositories';
import {NetworkType, WalletType} from './enums';
import {
  RateLimiterComponent,
  RateLimitSecurityBindings,
} from 'loopback4-ratelimiter';
import {omit} from 'lodash';
import {DateUtils} from './utils/date-utils';
import {Currency, Experience} from './models';

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
    this.service(NetworkService);

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
      await this.doMigrateExperience();
      await this.doMigrateComment();
      await this.doMigrateUser();
      await this.doMigrateNetwork();
      await this.doMigrateTransaction();
      await this.doMigrateUserCurrency();
      return;
    }
  }

  async doMigrateExperience(): Promise<void> {
    if (this.options.alter.indexOf('experience') === -1) return;
    const {experienceRepository} = await this.repositories();

    const collection = experienceRepository.dataSource.connector.collection(
      Experience.modelName,
    );

    await collection.updateMany(
      {},
      {
        $rename: {tags: 'allowedTags'},
        $set: {
          prohibitedTags: [],
          clonedCount: 0,
        },
      },
    );
  }

  async doMigrateComment(): Promise<void> {
    if (this.options.alter.indexOf('comment') === -1) return;
    const {commentRepository} = await this.repositories();

    await commentRepository.updateAll(
      {deleteByUser: false},
      {deleteByUser: {exists: false}},
    );
  }

  async doMigrateNetwork(): Promise<void> {
    if (this.options.alter.indexOf('network') === -1) return;
    const {currencyRepository, networkRepository} = await this.repositories();
    const environment =
      process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet';
    const rawNetworks = [
      {
        id: 'polkadot',
        image:
          'https://polkadot.network/assets/img/brand/Polkadot_Token_PolkadotToken_Pink.svg?v=3997aaa2a4',
        rpcURL: 'wss://rpc.polkadot.io',
        explorerURL:
          'https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Frpc.polkadot.io#/explorer/query',
        walletType: WalletType.POLKADOT,
      },
      {
        id: 'kusama',
        image:
          'https://pbs.twimg.com/profile_images/1430157114194944000/72gTG-fc_400x400.jpg',
        rpcURL: 'wss://kusama-rpc.polkadot.io',
        explorerURL:
          'https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Fkusama-rpc.polkadot.io#/explorer/query',
        walletType: WalletType.POLKADOT,
      },
      {
        id: 'myriad',
        image:
          'https://pbs.twimg.com/profile_images/1407599051579617281/-jHXi6y5_400x400.jpg',
        rpcURL: config.MYRIAD_RPC_WS_URL,
        explorerURL:
          'https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Fws-rpc.dev.myriad.social#/explorer/query',
        walletType: WalletType.POLKADOT,
      },
      {
        id: 'near',
        image:
          'https://pbs.twimg.com/profile_images/1441304555841597440/YPwdd6cd_400x400.jpg',
        rpcURL: `https://rpc.${environment}.near.org`,
        explorerURL: `https://explorer.${environment}.near.org`,
        walletType: WalletType.NEAR,
      },
    ];
    const rawCurrencies: Currency[] = [
      {
        name: 'myria',
        symbol: 'MYRIA',
        image:
          'https://pbs.twimg.com/profile_images/1407599051579617281/-jHXi6y5_400x400.jpg',
        decimal: 18,
        native: true,
        exchangeRate: false,
        networkId: 'myriad',
      },
      {
        name: 'kusama',
        symbol: 'KSM',
        image:
          'https://pbs.twimg.com/profile_images/1430157114194944000/72gTG-fc_400x400.jpg',
        decimal: 12,
        native: true,
        exchangeRate: true,
        networkId: 'kusama',
      },
      {
        name: 'polkadot',
        symbol: 'DOT',
        image:
          'https://pbs.twimg.com/profile_images/1471096119182700550/KTxlFVah_400x400.jpg',
        decimal: 10,
        native: true,
        exchangeRate: true,
        networkId: 'polkadot',
      },
      {
        name: 'near',
        symbol: 'NEAR',
        image:
          'https://theme.zdassets.com/theme_assets/10318540/556218f30048c6bdaa7c26a4b05d827af5a0198c.png',
        decimal: 24,
        native: true,
        exchangeRate: true,
        networkId: 'near',
      },
    ].map(currency => new Currency(currency));

    if (environment === 'mainnet') {
      rawCurrencies.push(
        new Currency({
          name: 'myriad',
          symbol: 'MYRIA',
          image:
            'https://pbs.twimg.com/profile_images/1407599051579617281/-jHXi6y5_400x400.jpg',
          decimal: 18,
          native: false,
          exchangeRate: false,
          networkId: 'near',
          referenceId: 'myriadcore.near',
        }),
      );
    }

    await currencyRepository.deleteAll();
    await currencyRepository.createAll(rawCurrencies);
    await networkRepository.createAll(rawNetworks);
  }

  async doMigrateTransaction(): Promise<void> {
    if (this.options.alter.indexOf('transaction') === -1) return;
    const {currencyRepository, transactionRepository} =
      await this.repositories();
    const currencies = await currencyRepository.find({
      where: {
        networkId: {inq: ['polkadot', 'kusama', 'myriad']},
      },
    });
    await Promise.all(
      currencies.map(async (currency: Currency) => {
        return transactionRepository.updateAll(
          {currencyId: currency.id},
          {currencyId: currency.symbol},
        );
      }),
    );
  }

  async doMigrateUser(): Promise<void> {
    if (this.options.alter.indexOf('user') === -1) return;
    const {
      accountSettingRepository,
      activityLogRepository,
      commentRepository,
      draftPostRepository,
      experienceUserRepository,
      experienceRepository,
      friendRepository,
      languageSettingRepository,
      notificationSettingRepository,
      notificationRepository,
      postRepository,
      reportRepository,
      userCurrencyRepository,
      userExperienceRepository,
      userReportRepository,
      userSocMedRepository,
      userRepository,
      voteRepository,
      walletRepository,
    } = await this.repositories();
    const {count} = await userRepository.count({id: /^0x/});
    const bar = this.initializeProgressBar('Alter user');

    await userCurrencyRepository.deleteAll();

    let i = 0;
    const start = true;

    bar.start(count, 0);
    while (start) {
      const oldUser = await userRepository.findOne({
        where: {
          id: {
            regexp: '^0x',
          },
        },
      });

      if (!oldUser) break;

      await userRepository.deleteById(oldUser.id);

      const rawUser = omit(oldUser, ['id']);
      const newUser = await userRepository.create(rawUser);
      const oldId = oldUser.id.toString();
      const newId = newUser.id.toString();

      await Promise.allSettled([
        this.accountSetting(oldId, newId, accountSettingRepository),
        this.activityLog(oldId, newId, activityLogRepository),
        this.commentMention(oldId, newId, commentRepository),
        this.comment(oldId, newId, commentRepository),
        this.draftPost(oldId, newId, draftPostRepository),
        this.experienceUser(oldId, newId, experienceUserRepository),
        this.experience(oldId, newId, experienceRepository),
        this.friend(oldId, newId, friendRepository),
        this.languageSetting(oldId, newId, languageSettingRepository),
        this.notifSetting(oldId, newId, notificationSettingRepository),
        this.notification(oldId, newId, notificationRepository),
        this.postMention(oldId, newId, postRepository),
        this.post(oldId, newId, postRepository),
        this.report(oldId, newId, reportRepository),
        this.userCurrency(newId, userCurrencyRepository),
        this.userExperience(oldId, newId, userExperienceRepository),
        this.userReport(oldId, newId, userReportRepository),
        this.userSocialMedia(oldId, newId, userSocMedRepository),
        this.vote(oldId, newId, voteRepository),
        this.wallet(oldId, newId, walletRepository),
      ]);

      i++;

      bar.update(i);
    }

    bar.stop();
  }

  async doMigrateUserCurrency(): Promise<void> {
    if (this.options.drop.indexOf('userCurrency') === -1) return;
    const {currencyRepository, userCurrencyRepository} =
      await this.repositories();

    const currency = await currencyRepository.findOne({
      where: {symbol: 'DOT'},
    });

    if (currency) {
      await userCurrencyRepository.updateAll(
        {currencyId: currency.id},
        {currencyId: 'DOT'},
      );
    }
  }

  async accountSetting(
    oldId: string,
    newId: string,
    accountSettingRepository: AccountSettingRepository,
  ): Promise<void> {
    await accountSettingRepository.updateAll({userId: newId}, {userId: oldId});
  }

  async activityLog(
    oldId: string,
    newId: string,
    activityLogRepository: ActivityLogRepository,
  ) {
    await activityLogRepository.updateAll({userId: newId}, {userId: oldId});
    await activityLogRepository.updateAll(
      {referenceId: newId},
      {referenceId: oldId},
    );
  }

  async commentMention(
    oldId: string,
    newId: string,
    commentRepository: CommentRepository,
  ) {
    const comments = await commentRepository.find({
      where: <AnyObject>{
        'mentions.id': oldId,
      },
    });

    await Promise.all(
      comments.map(async comment => {
        const mentions = comment.mentions.map(mention => {
          if (mention.id === oldId) {
            mention.id = newId;
          }
          return mention;
        });
        const currentText = `{\"type\":\"mention\",\"children\":[{\"text\":\"\"}],\"value\":\"${oldId}\"`;
        const updatedText = `{\"type\":\"mention\",\"children\":[{\"text\":\"\"}],\"value\":\"${newId}\"`;
        return commentRepository.updateById(comment.id, {
          mentions: mentions,
          text: comment.text?.replace(
            new RegExp(currentText, 'g'),
            updatedText,
          ),
        });
      }),
    );
  }

  async comment(
    oldId: string,
    newId: string,
    commentRepository: CommentRepository,
  ) {
    await commentRepository.updateAll({userId: newId}, {userId: oldId});
  }

  async draftPost(
    oldId: string,
    newId: string,
    draftPostRepository: DraftPostRepository,
  ) {
    await draftPostRepository.updateAll({createdBy: newId}, {createdBy: oldId});
  }

  async experienceUser(
    oldId: string,
    newId: string,
    experienceUserRepository: ExperienceUserRepository,
  ) {
    await experienceUserRepository.updateAll({userId: newId}, {userId: oldId});
  }

  async experience(
    oldId: string,
    newId: string,
    experienceRepository: ExperienceRepository,
  ) {
    await experienceRepository.updateAll(
      {createdBy: newId},
      {createdBy: oldId},
    );
  }

  async friend(
    oldId: string,
    newId: string,
    friendRepository: FriendRepository,
  ) {
    await friendRepository.updateAll(
      {requesteeId: newId},
      {requesteeId: oldId},
    );
    await friendRepository.updateAll(
      {requestorId: newId},
      {requestorId: oldId},
    );
  }

  async languageSetting(
    oldId: string,
    newId: string,
    languageSettingRepository: LanguageSettingRepository,
  ) {
    await languageSettingRepository.updateAll({userId: newId}, {userId: oldId});
  }

  async notifSetting(
    oldId: string,
    newId: string,
    notificationSettingRepository: NotificationSettingRepository,
  ) {
    await notificationSettingRepository.updateAll(
      {userId: newId},
      {userId: oldId},
    );
  }

  async notification(
    oldId: string,
    newId: string,
    notificationRepository: NotificationRepository,
  ) {
    await notificationRepository.updateAll(
      {referenceId: newId},
      {referenceId: oldId},
    );
    await notificationRepository.updateAll({from: newId}, {from: oldId});
    await notificationRepository.updateAll({to: newId}, {to: oldId});
    await notificationRepository.updateAll(
      <AnyObject>{'additionalReferenceId.comment.user.id': newId},
      <AnyObject>{'additionalReferenceId.comment.user.id': oldId},
    );

    await notificationRepository.updateAll(
      <AnyObject>{'additionalReferenceId.post.user.id': newId},
      <AnyObject>{'additionalReferenceId.post.user.id': oldId},
    );

    await notificationRepository.updateAll(
      <AnyObject>{'additionalReferenceId.user.id': newId},
      <AnyObject>{'additionalReferenceId.user.id': oldId},
    );
  }

  async postMention(
    oldId: string,
    newId: string,
    postRepository: PostRepository,
  ) {
    const posts = await postRepository.find({
      where: <AnyObject>{
        'mentions.id': oldId,
      },
    });

    await Promise.all(
      posts.map(async post => {
        const mentions = post.mentions.map(mention => {
          if (mention.id === oldId) {
            mention.id = newId;
          }
          return mention;
        });
        const currentText = `{\"type\":\"mention\",\"children\":[{\"text\":\"\"}],\"value\":\"${oldId}\"`;
        const updatedText = `{\"type\":\"mention\",\"children\":[{\"text\":\"\"}],\"value\":\"${newId}\"`;
        return postRepository.updateById(post.id, {
          mentions: mentions,
          text: post.text?.replace(new RegExp(currentText, 'g'), updatedText),
        });
      }),
    );
  }

  async post(oldId: string, newId: string, postRepository: PostRepository) {
    await postRepository.updateAll({createdBy: newId}, {createdBy: oldId});
  }

  async report(
    oldId: string,
    newId: string,
    reportRepository: ReportRepository,
  ) {
    await reportRepository.updateAll(
      {referenceId: newId},
      {referenceId: oldId},
    );
  }

  async userCurrency(
    newId: string,
    userCurrencyRepository: UserCurrencyRepository,
  ) {
    await userCurrencyRepository.create({
      networkId: NetworkType.POLKADOT,
      userId: newId,
      priority: 1,
      currencyId: 'DOT',
    });
  }

  async userExperience(
    oldId: string,
    newId: string,
    userExperienceRepository: UserExperienceRepository,
  ) {
    await userExperienceRepository.updateAll({userId: newId}, {userId: oldId});
  }

  async userReport(
    oldId: string,
    newId: string,
    userReportRepository: UserReportRepository,
  ) {
    await userReportRepository.updateAll(
      {reportedBy: newId},
      {reportedBy: oldId},
    );
  }

  async userSocialMedia(
    oldId: string,
    newId: string,
    userSocialMediaRepository: UserSocialMediaRepository,
  ) {
    await userSocialMediaRepository.updateAll({userId: newId}, {userId: oldId});
  }

  async vote(oldId: string, newId: string, voteRepository: VoteRepository) {
    await voteRepository.updateAll({userId: newId}, {userId: oldId});
  }

  async wallet(
    oldId: string,
    newId: string,
    walletRepository: WalletRepository,
  ) {
    await walletRepository.create({
      id: oldId,
      network: NetworkType.POLKADOT,
      type: WalletType.POLKADOT,
      primary: true,
      userId: newId,
    });
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
    const walletRepository = await this.getRepository(WalletRepository);

    return {
      accountSettingRepository,
      activityLogRepository,
      commentRepository,
      currencyRepository,
      draftPostRepository,
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
      tagRepository,
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

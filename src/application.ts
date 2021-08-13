import {AuthenticationComponent} from '@loopback/authentication';
import {BootMixin} from '@loopback/boot';
import {ApplicationConfig} from '@loopback/core';
import {RepositoryMixin, SchemaMigrationOptions} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {RestExplorerBindings, RestExplorerComponent} from '@loopback/rest-explorer';
import {ServiceMixin} from '@loopback/service-proxy';
import * as firebaseAdmin from 'firebase-admin';
import {MigrationBindings} from 'loopback4-migration';
import path from 'path';
import {JWTAuthenticationComponent, MigrationComponent} from './components';
import {config} from './configs';
import {MongoDataSource} from './datasources';
import {OptionType} from './enums';
import {AlterDatabase, UpdateUsers} from './migrations';
import {InitDatabase} from './migrations/init-database';
import {User} from './models';
import {
  CurrencyRepository,
  ExperienceRepository,
  FriendRepository,
  NotificationRepository,
  PeopleRepository,
  PostRepository,
  TagRepository,
  TransactionRepository,
  UserCurrencyRepository,
  UserExperienceRepository,
  UserRepository,
  UserSocialMediaRepository,
} from './repositories';
import {MySequence} from './sequence';
import {
  CurrencyService,
  ExperienceService,
  FCMService,
  FriendService,
  NotificationService,
  PostService,
  SocialMediaService,
  TagService,
  TransactionService,
  UserSocialMediaService,
} from './services';

export {ApplicationConfig};

export class MyriadApiApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    // Set up the custom sequence
    this.sequence(MySequence);

    // Set up default home page
    this.static('/', path.join(__dirname, '../public'));

    // Customize @loopback/rest-explorer configuration here
    this.configure(RestExplorerBindings.COMPONENT).to({
      path: '/explorer',
    });

    // Bind component
    this.bindComponent();

    // Bind services
    this.bindService();

    // Firebase initialization
    this.firebaseInit();

    this.bind(MigrationBindings.CONFIG).to({
      appVersion: '0.1.1',
      dataSourceName: MongoDataSource.dataSourceName,
      modelName: User.modelName,
      migrationScripts: [UpdateUsers],
    });

    this.projectRoot = __dirname;
    // Customize @loopback/boot Booter Conventions here
    this.bootOptions = {
      migrations: {
        dirs: ['migrations'],
        extensions: ['.migration.js'],
        nested: true,
      },
      controllers: {
        // Customize ControllerBooter Conventions here
        dirs: ['controllers'],
        extensions: ['.controller.js'],
        nested: true,
      },
    };
  }

  async migrateSchema(options?: SchemaMigrationOptions) {
    await super.migrateSchema(options);

    switch (options?.existingSchema) {
      case OptionType.DROP: {
        const init = await this.setInitDatabase();

        await init.createUsers();
        await init.createCurrencies();
        await init.createPeople();
        await init.createPost();

        break;
      }

      case OptionType.ALTER: {
        const alter = await this.setAlterDatabase();

        // await alter.updateUsers();
        // await alter.updatePosts();
        // await alter.updateTransactions();
        // await alter.updateFriends();
        // await alter.updatePeople();
        // await alter.updateNotifications();
        // await alter.updateCurrencies();
        // await alter.updateUserCurrency();
        // await alter.updateUserSocialMedia();

        break;
      }
    }
  }

  bindComponent() {
    this.component(RestExplorerComponent);
    this.component(AuthenticationComponent);
    this.component(JWTAuthenticationComponent);
    this.component(MigrationComponent);
  }

  bindService() {
    this.service(NotificationService);
    this.service(FriendService);
    this.service(UserSocialMediaService);
    this.service(TransactionService);
    this.service(SocialMediaService);
    this.service(CurrencyService);
    this.service(PostService);
    this.service(TagService);
    this.service(ExperienceService);

    // 3rd party service
    this.service(FCMService);
  }

  firebaseInit() {
    if (
      !config.FIREBASE_PROJECT_ID ||
      !config.FIREBASE_CLIENT_EMAIL ||
      !config.FIREBASE_PRIVATE_KEY
    ) {
      firebaseAdmin.initializeApp();
    } else {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert({
          projectId: config.FIREBASE_PROJECT_ID,
          clientEmail: config.FIREBASE_CLIENT_EMAIL,
          privateKey: config.FIREBASE_PRIVATE_KEY,
        }),
      });
    }
  }

  async getRepositories() {
    const currencyRepository = await this.getRepository(CurrencyRepository);
    const experienceRepository = await this.getRepository(ExperienceRepository);
    const peopleRepository = await this.getRepository(PeopleRepository);
    const postRepository = await this.getRepository(PostRepository);
    const tagRepository = await this.getRepository(TagRepository);
    const userCurrencyRepository = await this.getRepository(UserCurrencyRepository);
    const userExperienceRepository = await this.getRepository(UserExperienceRepository);
    const userRepository = await this.getRepository(UserRepository);
    const transactionRepository = await this.getRepository(TransactionRepository);
    const friendRepository = await this.getRepository(FriendRepository);
    const notificationRepository = await this.getRepository(NotificationRepository);
    const userSocialMediaRepository = await this.getRepository(UserSocialMediaRepository);

    return {
      userRepository,
      currencyRepository,
      peopleRepository,
      postRepository,
      userCurrencyRepository,
      tagRepository,
      experienceRepository,
      userExperienceRepository,
      transactionRepository,
      friendRepository,
      notificationRepository,
      userSocialMediaRepository,
    };
  }

  async setInitDatabase() {
    const repositories = await this.getRepositories();

    return new InitDatabase(
      repositories.userRepository,
      repositories.currencyRepository,
      repositories.peopleRepository,
      repositories.postRepository,
      repositories.userCurrencyRepository,
      repositories.tagRepository,
      repositories.experienceRepository,
      repositories.userExperienceRepository,
    );
  }

  async setAlterDatabase() {
    const repositories = await this.getRepositories();

    return new AlterDatabase(
      repositories.userRepository,
      repositories.postRepository,
      repositories.transactionRepository,
      repositories.peopleRepository,
      repositories.friendRepository,
      repositories.notificationRepository,
      repositories.currencyRepository,
      repositories.userCurrencyRepository,
      repositories.userSocialMediaRepository,
    );
  }
}

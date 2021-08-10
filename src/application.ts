import {AuthenticationComponent} from '@loopback/authentication';
import {BootMixin} from '@loopback/boot';
import {ApplicationConfig} from '@loopback/core';
import {RepositoryMixin, SchemaMigrationOptions} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {RestExplorerBindings, RestExplorerComponent} from '@loopback/rest-explorer';
import {ServiceMixin} from '@loopback/service-proxy';
import dotenv from 'dotenv';
import * as firebaseAdmin from 'firebase-admin';
import path from 'path';
import {JWTAuthenticationComponent} from './components';
import currencySeed from './data-seed/currencies.json';
import peopleSeed from './data-seed/people.json';
import postSeed from './data-seed/posts.json';
import userSeed from './data-seed/users.json';
import {ExtendedPost} from './interfaces';
import {InitDatabase} from './migrations/init-database';
import {Currency, People, User} from './models';
import {
  CurrencyRepository,
  ExperienceRepository,
  PeopleRepository,
  PostRepository,
  TagRepository,
  UserCurrencyRepository,
  UserExperienceRepository,
  UserRepository,
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

dotenv.config();

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

    this.projectRoot = __dirname;
    // Customize @loopback/boot Booter Conventions here
    this.bootOptions = {
      controllers: {
        // Customize ControllerBooter Conventions here
        dirs: ['controllers'],
        extensions: ['.controller.js'],
        nested: true,
      },
    };
  }

  bindComponent() {
    this.component(RestExplorerComponent);
    this.component(AuthenticationComponent);
    this.component(JWTAuthenticationComponent);
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
      !process.env.FIREBASE_PROJECT_ID ||
      !process.env.FIREBASE_CLIENT_EMAIL ||
      !process.env.FIREBASE_PRIVATE_KEY
    ) {
      firebaseAdmin.initializeApp();
    } else {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID ?? '',
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? '',
          privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
        }),
      });
    }
  }

  async migrateSchema(options?: SchemaMigrationOptions) {
    await super.migrateSchema(options);

    const init = await this.setInitDatabase();

    await init.createUsers(userSeed as User[]);
    await init.createCurrencies(currencySeed as Currency[]);
    await init.createPeople(peopleSeed as People[]);
    await init.createPost(postSeed as ExtendedPost[]);
  }

  async setInitDatabase(): Promise<InitDatabase> {
    const currencyRepository = await this.getRepository(CurrencyRepository);
    const experienceRepository = await this.getRepository(ExperienceRepository);
    const peopleRepository = await this.getRepository(PeopleRepository);
    const postRepository = await this.getRepository(PostRepository);
    const tagRepository = await this.getRepository(TagRepository);
    const userCurrencyRepository = await this.getRepository(UserCurrencyRepository);
    const userExperienceRepository = await this.getRepository(UserExperienceRepository);
    const userRepository = await this.getRepository(UserRepository);

    return new InitDatabase(
      userRepository,
      currencyRepository,
      peopleRepository,
      postRepository,
      userCurrencyRepository,
      tagRepository,
      experienceRepository,
      userExperienceRepository,
    );
  }
}

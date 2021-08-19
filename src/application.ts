import {AuthenticationComponent} from '@loopback/authentication';
import {BootMixin} from '@loopback/boot';
import {ApplicationConfig} from '@loopback/core';
import {RepositoryMixin} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {RestExplorerBindings, RestExplorerComponent} from '@loopback/rest-explorer';
import {ServiceMixin} from '@loopback/service-proxy';
import * as firebaseAdmin from 'firebase-admin';
import {MigrationBindings, MigrationComponent} from 'loopback4-migration';
import path from 'path';
import {JWTAuthenticationComponent} from './components';
import {config} from './config';
import {MongoDataSource} from './datasources';
import {MyriadSequence} from './sequence';
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
    this.sequence(MyriadSequence);

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

    if (!this.options.test) {
      this.component(MigrationComponent);
      this.bind(MigrationBindings.CONFIG).to({
        dataSourceName: MongoDataSource.dataSourceName,
        modelName: 'db_migrations',
      });
    }
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
    if (this.options.test) return;
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
}

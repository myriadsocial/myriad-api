import {BootMixin} from '@loopback/boot';
import {ApplicationConfig, createBindingFromClass} from '@loopback/core';
import {CronComponent} from '@loopback/cron';
import {RepositoryMixin} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {
  RestExplorerBindings,
  RestExplorerComponent,
} from '@loopback/rest-explorer';
import {ServiceMixin} from '@loopback/service-proxy';
import dotenv from 'dotenv';
import * as firebaseAdmin from 'firebase-admin';
import path from 'path';
import {FetchContentSocialMediaJob} from './jobs';
import {MySequence} from './sequence';
import {
  NotificationService,
  UserCredentialService,
  TransactionService,
  FriendService,
  SocialMediaService,
  TagService,
  PostService,
  MetricService,
  CryptocurrencyService,
  FCMService,
} from './services';
import {AuthenticationComponent} from '@loopback/authentication';
import {JWTAuthenticationComponent} from './jwt-authentication-component';

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

    this.add(createBindingFromClass(FetchContentSocialMediaJob));

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

    // initialize firebase app
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID ?? '',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? '',
        privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(
          /\\n/g,
          '\n',
        ),
      }),
    });
  }

  bindComponent() {
    // Add component
    this.component(CronComponent); // Add cron component
    this.component(RestExplorerComponent);
    this.component(AuthenticationComponent);
    this.component(JWTAuthenticationComponent); // Mount jwt component
  }

  bindService() {
    // Add services
    this.service(NotificationService);
    this.service(FriendService);
    this.service(UserCredentialService);
    this.service(TransactionService);
    this.service(SocialMediaService);
    this.service(CryptocurrencyService);
    this.service(PostService);
    this.service(TagService);
    this.service(MetricService);
    this.service(FCMService);
  }
}

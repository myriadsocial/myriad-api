import {BootMixin} from '@loopback/boot';
import {ApplicationConfig, createBindingFromClass} from '@loopback/core';
import {CronComponent} from '@loopback/cron';
import {RepositoryMixin} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {
  RestExplorerBindings,
  RestExplorerComponent
} from '@loopback/rest-explorer';
import {ServiceMixin} from '@loopback/service-proxy';
import dotenv from 'dotenv';
import * as firebaseAdmin from 'firebase-admin';
import path from 'path';
import {
  FetchContentSocialMediaJob, RemovedContentJob
} from './jobs';
import {MySequence} from './sequence';
import {NotificationService} from './services';

import {AuthenticationComponent} from '@loopback/authentication';
import {JWTAuthenticationComponent} from './jwt-authentication-component'

dotenv.config()

export {ApplicationConfig};

export class MyriadApiApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    this.component(AuthenticationComponent);
    // Mount jwt component
    this.component(JWTAuthenticationComponent);

    // Set up the custom sequence
    this.sequence(MySequence);

    // Set up default home page
    this.static('/', path.join(__dirname, '../public'));

    // Customize @loopback/rest-explorer configuration here
    this.configure(RestExplorerBindings.COMPONENT).to({
      path: '/explorer',
    });
    this.component(RestExplorerComponent);

    // Add cron component
    this.component(CronComponent);
    // Deactivate cron job for now
    // this.add(createBindingFromClass(FetchContentSocialMediaJob))
    // this.add(createBindingFromClass(RemovedContentJob))
    // Optional:
    // this.add(createBindingFromClass(FetchContentTwitterJob))
    // this.add(createBindingFromClass(FetchContentRedditJob))
    // this.add(createBindingFromClass(UpdatePostsJob))

    // Add services
    this.service(NotificationService)

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
        projectId: (process.env.FIREBASE_PROJECT_ID ?? ""),
        clientEmail: (process.env.FIREBASE_CLIENT_EMAIL ?? ""),
        privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, '\n'),
      }),
    })
  }
}

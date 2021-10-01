import {AuthenticationComponent} from '@loopback/authentication';
import {BootMixin} from '@loopback/boot';
import {ApplicationConfig} from '@loopback/core';
import {HealthComponent} from '@loopback/health';
import {RepositoryMixin} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {LoggingComponent} from '@loopback/logging';
import {
  RestExplorerBindings,
  RestExplorerComponent,
} from '@loopback/rest-explorer';
import {ServiceMixin} from '@loopback/service-proxy';
import * as firebaseAdmin from 'firebase-admin';
import {MigrationBindings, MigrationComponent} from 'loopback4-migration';
import path from 'path';
import {JWTAuthenticationComponent} from './components';
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
import {
  LoggingBindings,
  WinstonLoggerOptions,
  WINSTON_FORMAT,
  WINSTON_TRANSPORT,
  WinstonFormat,
  WinstonTransports,
} from '@loopback/logging';
import {format} from 'winston';
import {extensionFor} from '@loopback/core';
import express, {Request, Response} from 'express';
require('gun/sea');
const Gun = require('gun');
import http from 'http';
import {once} from 'events';

export {ApplicationConfig};

export class ExpressServer {
  public readonly app: express.Application;
  public readonly myriadApp: MyriadApiApplication;
  public readonly gun: any;
  private server?: http.Server;

  constructor(options: ApplicationConfig = {}) {
    this.app = express();
    this.myriadApp = new MyriadApiApplication(options);
    this.app.use('/lb', this.myriadApp.requestHandler);
    const port = process.env.PORT;
    this.gun = Gun({
      web: this.app.listen(port, () => {
        console.log(
          '**Express & Loopback with GunDB is running at http://localhost:' +
            port +
            '**',
        );
      }),
      peers: [process.env.GUN_HOST],
      axe: false,
      multicast: {
        port: process.env.GUN_PORT,
      },
    });
    this.app.use(Gun.serve);
    this.gun.get('dummy').once((s: any) => console.log(s));
    this.app.get('/', (_req: Request, res: Response) => {
      res.sendFile(path.resolve('public/express.html'));
    });
  }
  async boot() {
    await this.myriadApp.boot();
  }

  public async start() {
    await this.myriadApp.start();
    const port = this.myriadApp.restServer.config.port ?? 3000;
    const host = this.myriadApp.restServer.config.host || '127.0.0.1';
    this.server = this.app.listen(port, host);
    await once(this.server, 'listening');
  }

  // For testing purposes
  public async stop() {
    if (!this.server) return;
    await this.myriadApp.stop();
    this.server.close();
    await once(this.server, 'close');
    this.server = undefined;
  }
}
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
    this.configure(LoggingBindings.COMPONENT).to({
      enableFluent: false,
      enableHttpAccessLog: true,
    });

    this.configure<WinstonLoggerOptions>(LoggingBindings.WINSTON_LOGGER).to({
      level: 'info',
      format: format.json(),
      defaultMeta: {framework: 'LoopBack'},
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
    this.component(HealthComponent);
    this.component(LoggingComponent);

    if (this.options.test) return;

    this.component(MigrationComponent);
    this.bind(MigrationBindings.CONFIG).to({
      dataSourceName: MongoDataSource.dataSourceName,
      modelName: 'db_migrations',
    });

    const myFormat: WinstonFormat = format((info, opts) => {
      console.log(info);
      return false;
    })();

    this.bind('logging.winston.formats.myFormat')
      .to(myFormat)
      .apply(extensionFor(WINSTON_FORMAT));
    this.bind('logging.winston.formats.colorize')
      .to(format.colorize())
      .apply(extensionFor(WINSTON_FORMAT));

    const consoleTransport = new WinstonTransports.Console({
      level: 'info',
      format: format.combine(format.colorize(), format.simple()),
    });
    this.bind('logging.winston.transports.console')
      .to(consoleTransport)
      .apply(extensionFor(WINSTON_TRANSPORT));
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
    firebaseAdmin.initializeApp();
  }
}

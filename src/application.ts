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
  MyriadNodeService,
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
import {WsProvider, ApiPromise} from '@polkadot/api';
import {config} from './config';
import myriadTypes from './data-seed/myriad-types.json';
import {PlatformType} from './enums';
import {PolkadotJs} from './utils/polkadotJs-utils';

export {ApplicationConfig};

const {getKeyring} = new PolkadotJs();

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
    this.service(MyriadNodeService);

    // 3rd party service
    this.service(FCMService);
  }

  firebaseInit() {
    if (this.options.test) return;
    firebaseAdmin.initializeApp();
  }

  async myriadNodeInit() {
    if (this.options.test) return;
    try {
      const provider = new WsProvider(config.MYRIAD_WS_RPC, false);
      await provider.connect();
      const api = await new ApiPromise({provider, types: myriadTypes})
        .isReadyOrError;

      const platforms =
        ((await api.query.platform.platforms()).toHuman() as string[]) ?? [];
      const defaultPlatforms = [
        PlatformType.FACEBOOK,
        PlatformType.REDDIT,
        PlatformType.TWITTER,
      ];

      const mnemonic = config.MYRIAD_MNEMONIC;
      const signer = getKeyring().addFromMnemonic(mnemonic);
      const {nonce} = await api.query.system.account(signer.address);

      for (let i = 0; i < defaultPlatforms.length; i++) {
        const defaultPlatform = defaultPlatforms[i];
        const found = platforms.find(platform => defaultPlatform === platform);

        if (found) continue;

        try {
          const tx = api.tx.platform.addPlatform(defaultPlatform);

          await tx.signAndSend(signer, {nonce: nonce.toNumber() + i});
        } catch {
          // ignore
        }
      }

      await api.disconnect();
    } catch {
      // ignore
    }
  }
}

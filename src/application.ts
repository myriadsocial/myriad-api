import {AuthenticationComponent} from '@loopback/authentication';
import {BootMixin} from '@loopback/boot';
import {
  ApplicationConfig,
  createBindingFromClass,
  inject,
} from '@loopback/core';
import {HealthComponent} from '@loopback/health';
import {RepositoryMixin} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {LoggingComponent} from '@loopback/logging';
import {
  RestExplorerBindings,
  RestExplorerComponent,
} from '@loopback/rest-explorer';
import {getService, ServiceMixin} from '@loopback/service-proxy';
import * as firebaseAdmin from 'firebase-admin';
import {MigrationBindings, MigrationComponent} from 'loopback4-migration';
import {config} from './config';
import path from 'path';
import {JWTAuthenticationComponent} from './components';
import {CoinMarketCapDataSource, MongoDataSource} from './datasources';
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
  CoinMarketCap,
  CoinMarketCapProvider,
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
import {UpdateExchangeRateJob, UpdateTrendingTopicJob} from './jobs';
import {CronComponent} from '@loopback/cron';
import multer from 'multer';
import {v4 as uuid} from 'uuid';
import {FILE_UPLOAD_SERVICE} from './keys';
import {FCSService} from './services/fcs.service';
import {CurrencyRepository, ExchangeRateRepository} from './repositories';

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

    // Bind job
    this.bindJob();

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
    this.component(CronComponent);
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

    // Configure file upload with multer options
    this.configureFileUpload();
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
    this.service(MetricService);
    this.service(ActivityLogService);

    // 3rd party service
    this.service(FCMService);
    this.service(FCSService);
  }

  bindJob() {
    this.add(createBindingFromClass(UpdateExchangeRateJob));
    this.add(createBindingFromClass(UpdateTrendingTopicJob));
  }

  firebaseInit() {
    if (this.options.test) return;
    firebaseAdmin.initializeApp({
      storageBucket: config.FIREBAE_STORAGE_BUCKET,
    });
  }

  async initialExchangeRates(): Promise<void> {
    const currencyRepository = await this.getRepository(CurrencyRepository);
    const exchangeRateRepository = await this.getRepository(
      ExchangeRateRepository,
    );

    const dataSource = new CoinMarketCapDataSource();
    const coinMarketCapService = await new CoinMarketCapProvider(
      dataSource,
    ).value();

    const currencies = await currencyRepository.find({
      where: {
        exchangeRate: true,
      },
    });

    const currencyIds = currencies.map(currency => currency.id);

    if (currencyIds.length === 0) return;

    try {
      const {data} = await coinMarketCapService.getActions(
        `cryptocurrency/quotes/latest?symbol=${currencyIds.join(',')}`,
      );

      for (const currencyId of currencyIds) {
        const price = data[currencyId].quote.USD.price;
        const found = await exchangeRateRepository.findOne({
          where: {
            id: currencyId,
          },
        });

        if (found) {
          await exchangeRateRepository.updateById(currencyId, {
            price: price,
            updatedAt: new Date().toString(),
          });
        } else {
          await exchangeRateRepository.create({
            id: currencyId,
            price: price,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * Configure `multer` options for file upload
   */
  protected configureFileUpload() {
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
}

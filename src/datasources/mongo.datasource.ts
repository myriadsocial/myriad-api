import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {AnyObject, juggler} from '@loopback/repository';
import {config as mongoConfig} from '../config';

const config = {
  name: 'mongo',
  connector: 'mongodb',
  protocol: 'mongodb',
  host: '',
  port: 27017,
  user: 'root',
  password: 'root',
  database: 'myriad',
  url: '',
  allowExtendedOperators: true,
  enableGeoIndexing: true,
};

function updateConfig(dsConfig: AnyObject) {
  if (dsConfig.test) return dsConfig;
  if (mongoConfig.MONGO_PROTOCOL) {
    dsConfig.protocol = mongoConfig.MONGO_PROTOCOL;
  }
  if (mongoConfig.MONGO_HOST) {
    dsConfig.host = mongoConfig.MONGO_HOST;
  }
  dsConfig.port = mongoConfig.MONGO_PORT;
  if (mongoConfig.MONGO_USER) {
    dsConfig.user = mongoConfig.MONGO_USER;
  }
  if (mongoConfig.MONGO_PASSWORD) {
    dsConfig.password = mongoConfig.MONGO_PASSWORD;
  }
  if (mongoConfig.MONGO_DATABASE) {
    dsConfig.database = mongoConfig.MONGO_DATABASE;
  }
  if (mongoConfig.MONGO_URL) {
    dsConfig.url = mongoConfig.MONGO_URL;
  }

  return dsConfig;
}

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The `stop()` method is inherited from `juggler.DataSource`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver('datasource')
export class MongoDataSource
  extends juggler.DataSource
  implements LifeCycleObserver
{
  static readonly dataSourceName = config.name;
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.mongo', {optional: true})
    dsConfig: AnyObject = config,
  ) {
    super(updateConfig(dsConfig));
  }
}

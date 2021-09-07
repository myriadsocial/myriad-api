import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {AnyObject, juggler} from '@loopback/repository';
import {config} from '../config';

const mongoConfig = {
  name: 'mongo',
  connector: 'mongodb',
  url: '',
  host: 'localhost',
  port: 27017,
  user: 'root',
  password: 'root',
  database: 'myriad',
  allowExtendedOperators: true,
};

function updateConfig(dsConfig: AnyObject) {
  if (config.MONGO_HOST) {
    dsConfig.host = config.MONGO_HOST;
  }
  const envPort = config.MONGO_PORT;
  if (Number.isInteger(envPort)) {
    dsConfig.port = envPort;
  }
  if (config.MONGO_USER) {
    dsConfig.user = config.MONGO_USER;
  }
  if (config.MONGO_PASSWORD) {
    dsConfig.password = config.MONGO_PASSWORD;
  }
  if (config.MONGO_DATABASE) {
    dsConfig.database = config.MONGO_DATABASE;
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
  static readonly dataSourceName = mongoConfig.name;
  static readonly defaultConfig = mongoConfig;

  constructor(
    @inject('datasources.config.mongo', {optional: true})
    dsConfig: AnyObject = mongoConfig,
  ) {
    super(updateConfig(dsConfig));
  }
}

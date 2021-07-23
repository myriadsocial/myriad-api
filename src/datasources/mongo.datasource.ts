import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {AnyObject, juggler} from '@loopback/repository';

const config = {
  name: 'mongo',
  connector: 'mongodb',
  url: '',
  host: 'localhost',
  port: 27017,
  user: 'root',
  password: 'root',
  database: 'myriad',
};

function updateConfig(dsConfig: AnyObject) {
  if (process.env.MONGO_HOST) {
    dsConfig.host = process.env.MONGO_HOST;
  }
  const envPort = parseInt(process.env.MONGO_PORT ?? '');
  if (Number.isInteger(envPort)) {
    dsConfig.port = envPort;
  }
  if (process.env.MONGO_USER) {
    dsConfig.user = process.env.MONGO_USER;
  }
  if (process.env.MONGO_PASSWORD) {
    dsConfig.password = process.env.MONGO_PASSWORD;
  }
  if (process.env.MONGO_DATABASE) {
    dsConfig.database = process.env.MONGO_DATABASE;
  }
  return dsConfig;
}

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The `stop()` method is inherited from `juggler.DataSource`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver('datasource')
export class MongoDataSource extends juggler.DataSource implements LifeCycleObserver {
  static readonly dataSourceName = config.name;
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.mongo', {optional: true})
    dsConfig: AnyObject = config,
  ) {
    super(updateConfig(dsConfig));
  }
}

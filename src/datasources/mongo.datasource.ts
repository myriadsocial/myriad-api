import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {AnyObject, juggler} from '@loopback/repository';
import {config as mongoConfig} from '../config';

const config = {
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
  if (dsConfig.test) return dsConfig;
  dsConfig.user = mongoConfig.MONGO_USER;
  dsConfig.password = mongoConfig.MONGO_PASSWORD;
  dsConfig.database = mongoConfig.MONGO_DATABASE;
  if (mongoConfig.MONGO_HOSTS) {
    dsConfig.url = `mongodb://${dsConfig.user}:${dsConfig.password}@${mongoConfig.MONGO_HOSTS}/${dsConfig.database}?replicaSet=rs0`;
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

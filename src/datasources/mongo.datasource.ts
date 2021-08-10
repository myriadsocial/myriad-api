import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {AnyObject, juggler} from '@loopback/repository';
import {mongo} from '../configs';

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
  if (mongo.host) {
    dsConfig.host = mongo.host;
  }
  const envPort = mongo.port;
  if (Number.isInteger(envPort)) {
    dsConfig.port = envPort;
  }
  if (mongo.user) {
    dsConfig.user = mongo.user;
  }
  if (mongo.password) {
    dsConfig.password = mongo.password;
  }
  if (mongo.database) {
    dsConfig.database = mongo.database;
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

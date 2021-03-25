import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {AnyObject, juggler} from '@loopback/repository';

const config = {
  name: 'mongo',
  connector: 'mongodb',
  url: '',
  host: '127.0.0.1',
  port: 27017,
  user: 'root',
  password: 'root',
  database: 'myriad',
  useNewUrlParser: true
};

function updateConfig(dsConfig: AnyObject) {
  // TODO: make it from environment config
  return dsConfig;
}

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The `stop()` method is inherited from `juggler.DataSource`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver('datasource')
export class MongoDataSource extends juggler.DataSource
  implements LifeCycleObserver {
  static readonly dataSourceName = config.name;
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.mongo', {optional: true})
    dsConfig: AnyObject = config,
  ) {
    super(updateConfig(dsConfig));
  }
}

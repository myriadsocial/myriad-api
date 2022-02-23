import {
  inject,
  lifeCycleObserver,
  LifeCycleObserver,
  ValueOrPromise,
} from '@loopback/core';
import {AnyObject, juggler} from '@loopback/repository';
import {config as redisConfig} from '../config';

const config = {
  name: 'redis',
  connector: 'kv-redis',
  host: 'localhost',
  url: '',
  port: 6379,
  password: '',
  db: 0,
};

function updateConfig(dsConfig: AnyObject) {
  if (redisConfig.REDIS_CONNECTOR !== 'kv-redis') {
    return {
      name: 'redis',
      connector: 'kv-memory',
    };
  }
  if (redisConfig.REDIS_HOST) {
    dsConfig.host = redisConfig.REDIS_HOST;
  }
  if (redisConfig.REDIS_PORT) {
    dsConfig.port = redisConfig.REDIS_PORT;
  }
  if (redisConfig.REDIS_PASSWORD) {
    dsConfig.password = redisConfig.REDIS_PASSWORD;
  }

  return dsConfig;
}

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The `stop()` method is inherited from `juggler.DataSource`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver('datasource')
export class RedisDataSource
  extends juggler.DataSource
  implements LifeCycleObserver
{
  static readonly dataSourceName = config.name;
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.redis', {optional: true})
    dsConfig: AnyObject = config,
  ) {
    super(updateConfig(dsConfig));
  }

  /**
   * Disconnect the datasource when application is stopped. This allows the
   * application to be shut down gracefully.
   */
  stop(): ValueOrPromise<void> {
    return super.disconnect();
  }
}

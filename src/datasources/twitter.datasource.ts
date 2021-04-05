import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';
import { config as dotenvConfig} from 'dotenv'
dotenvConfig()

const config = {
  name: 'twitter',
  connector: 'rest',
  baseURL: 'https://api.twitter.com/2/',
  crud: false,
  options: {
    headers: {
      Authorization: `Bearer ${process.env.BEARER_TOKEN}`
    }
  },
  operations: [
    {
      template: {
        method: 'GET',
        url: 'https://api.twitter.com/2/{action}'
      },
      functions: {
        getActions: ['action']
      }
    }
  ]
};

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The `stop()` method is inherited from `juggler.DataSource`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver('datasource')
export class TwitterDataSource extends juggler.DataSource
  implements LifeCycleObserver {
  static dataSourceName = 'twitter';
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.twitter', {optional: true})
    dsConfig: object = config,
  ) {
    super(dsConfig);
  }
}

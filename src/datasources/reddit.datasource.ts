import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';

const config = {
  name: 'reddit',
  connector: 'rest',
  baseURL: 'https://reddit.com',
  crud: false,
  options: {
    headers: {},
  },
  operations: [
    {
      template: {
        method: 'GET',
        url: 'https://reddit.com/{actions}',
      },
      functions: {
        getActions: ['actions'],
      },
    },
  ],
};

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The `stop()` method is inherited from `juggler.DataSource`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver('datasource')
export class RedditDataSource
  extends juggler.DataSource
  implements LifeCycleObserver
{
  static dataSourceName = 'reddit';
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.reddit', {optional: true})
    dsConfig: object = config,
  ) {
    super(dsConfig);
  }
}

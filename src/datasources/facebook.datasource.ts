import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';

const config = {
  name: 'facebook',
  connector: 'rest',
  baseURL: 'https://mbasic.facebook.com',
  crud: false,
  options: {
    headers: {
      'user-agent':
        'Mozilla/5.0 (platform; rv:geckoversion) Gecko/geckotrail Firefox/firefoxversion',
    },
  },
  operations: [
    {
      template: {
        method: 'GET',
        url: 'https://mbasic.facebook.com/{pageId}/posts/{postId}',
      },
      functions: {
        getActions: ['pageId', 'postId'],
      },
    },
  ],
};

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The `stop()` method is inherited from `juggler.DataSource`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver('datasource')
export class FacebookDataSource
  extends juggler.DataSource
  implements LifeCycleObserver
{
  static dataSourceName = 'facebook';
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.facebook', {optional: true})
    dsConfig: object = config,
  ) {
    super(dsConfig);
  }
}

import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';

const config = {
  name: 'facebook',
  connector: 'rest',
  baseURL: 'https://facebook.com',
  crud: false,
  options: {
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone11,8;FBMD/iPhone;FBSN/iOS;FBSV/13.3.1;FBSS/2;FBID/phone;FBLC/en_US;FBOP/5;FBCR/]"
    }
  },
  operations: [
    {
      template: {
        method: 'GET',
        url: 'https://facebook.com/{pageId}/posts/{postId}',
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
export class FacebookDataSource extends juggler.DataSource implements LifeCycleObserver {
  static dataSourceName = 'facebook';
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.facebook', {optional: true})
    dsConfig: object = config,
  ) {
    super(dsConfig);
  }
}

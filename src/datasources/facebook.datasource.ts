import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';

const config = {
  name: 'facebook',
  connector: 'rest',
  baseURL: 'https://mbasic.facebook.com',
  crud: false,
  options: {
    headers: {
      "content-type": "text/html",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.181 Safari/537.36"
    }
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

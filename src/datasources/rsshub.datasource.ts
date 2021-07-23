import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';

const config = {
  name: 'rsshub',
  connector: 'rest',
  baseURL: 'https://rsshub.app/',
  crud: false,
  options: {
    headers: {
      accept: 'application/xml',
    },
  },
  operations: [
    {
      template: {
        method: 'GET',
        url: 'https://rsshub.app/facebook/page/{username}',
      },
      functions: {
        getContents: ['username'],
      },
    },
  ],
};

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The `stop()` method is inherited from `juggler.DataSource`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver('datasource')
export class RsshubDataSource extends juggler.DataSource implements LifeCycleObserver {
  static readonly dataSourceName = config.name;
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.rsshub', {optional: true})
    dsConfig: object = config,
  ) {
    super(dsConfig);
  }
}

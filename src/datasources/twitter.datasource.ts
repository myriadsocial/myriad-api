import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';

const config = {
  name: 'twitter',
  connector: 'rest',
  baseURL: 'https://api.twitter.com/2/',
  crud: false,
  options: {
    headers: {
      Authorization: 'Bearer AAAAAAAAAAAAAAAAAAAAAFDdOAEAAAAA7NWJGsd4XSINjo3etc1c13M9WX8%3D6FkeDeBcLVKKzAkw5zqoxWazvMtNcb9R5BaqUlDDunrhKbrhRm'
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

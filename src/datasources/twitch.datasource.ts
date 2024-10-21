import { inject, lifeCycleObserver, LifeCycleObserver } from '@loopback/core';
import { juggler } from '@loopback/repository';
import {config} from '../config';

const twitchConfig = {
  name: 'twitch',
  connector: 'rest',
  baseUrl: 'https://api.twitch.tv/helix',
  crud: false,
  options: {
    headers: {
      'Client-ID': config.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${config.TWITCH_ACCESS_TOKEN}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    strictSSL: true,
  },
  operations: [
    {
      template: {
        method: 'GET',
        url: '/videos',
        query: {
          id: '{id}',
        },
      },
      functions: {
        getVideoById: ['id'],
      },
    },
    {
      template: {
        method: 'GET',
        url: '/clips',
        query: {
          id: '{id}',
        },
      },
      functions: {
        getClipById: ['id'],
      },
    },
  ],
};

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The `stop()` method is inherited from `juggler.DataSource`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver('datasource')
export class TwitchDataSource
  extends juggler.DataSource
  implements LifeCycleObserver
{
  static dataSourceName = 'twitch';
  static readonly defaultConfig = twitchConfig;

  constructor(
    @inject('datasources.config.twitch', {optional: true})
    dsConfig: object = twitchConfig,
  ) {
    super(dsConfig);
  }
}
import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';
import {config} from '../config';

const youtubeConfig = {
  name: 'youtube',
  connector: 'rest',
  baseUrl: 'https://www.googleapis.com/youtube/v3',
  crud: false,
  options: {
    headers: {
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
          part: '{part=snippet}',
          id: '{id}',
          key: '{key=' + config.YOUTUBE_API_KEY + '}',
        },
      },
      functions: {
        getVideos: ['part', 'id'],
      },
    },
    {
      template: {
        method: 'GET',
        url: '/search',
        query: {
          part: '{part=snippet}',
          q: '{q}',
          type: '{type=video}',
          key: '{key=' + config.YOUTUBE_API_KEY + '}',
        },
      },
      functions: {
        search: ['part', 'q', 'type'],
      },
    },
  ],
};

@lifeCycleObserver('datasource')
export class YouTubeDataSource
  extends juggler.DataSource
  implements LifeCycleObserver
{
  static dataSourceName = 'youtube';
  static readonly defaultConfig = youtubeConfig;

  constructor(
    @inject('datasources.config.youtube', {optional: true})
    dsConfig: object = youtubeConfig,
  ) {
    super(dsConfig);
  }
}

import {inject, LifeCycleObserver, lifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';
import {config} from '../config';

const coinMarketCapConfig = {
  name: 'coinmarketcap',
  connector: 'rest',
  baseURL: 'https://pro-api.coinmarketcap.com/v1/',
  crud: false,
  options: {
    headers: {
      'X-CMC_PRO_API_KEY': config.COIN_MARKET_CAP_API_KEY,
    },
  },
  operations: [
    {
      template: {
        method: 'GET',
        url: 'https://pro-api.coinmarketcap.com/v1/{actions}',
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
export class CoinMarketCapDataSource
  extends juggler.DataSource
  implements LifeCycleObserver
{
  static dataSourceName = coinMarketCapConfig.name;
  static readonly defaultConfig = coinMarketCapConfig;

  constructor(
    @inject('datasources.config.coinmarketcap', {optional: true})
    dsConfig: object = coinMarketCapConfig,
  ) {
    super(dsConfig);
  }
}

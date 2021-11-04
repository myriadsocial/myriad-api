import {inject, Provider} from '@loopback/core';
import {getService} from '@loopback/service-proxy';
import {CoinMarketCapDataSource} from '../datasources';

/* eslint-disable  @typescript-eslint/no-explicit-any */
export interface CoinMarketCap {
  // this is where you define the Node.js methods that will be
  // mapped to REST/SOAP/gRPC operations as stated in the datasource
  // json file.
  getActions(action: String): Promise<any>;
}

export class CoinMarketCapProvider implements Provider<CoinMarketCap> {
  constructor(
    @inject('datasources.coinmarketcap')
    protected datasource: CoinMarketCapDataSource = new CoinMarketCapDataSource(),
  ) {}

  value(): Promise<CoinMarketCap> {
    return getService(this.datasource);
  }
}

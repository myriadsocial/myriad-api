import {inject, Provider} from '@loopback/core';
import {getService} from '@loopback/service-proxy';
import {TwitterDataSource} from '../../datasources';

/* eslint-disable  @typescript-eslint/no-explicit-any */
export interface Twitter {
  // this is where you define the Node.js methods that will be
  // mapped to REST/SOAP/gRPC operations as stated in the datasource
  // json file.
  getActions(action: String): Promise<any>;
}

export class TwitterProvider implements Provider<Twitter> {
  constructor(
    // twitter must match the name property in the datasource json file
    @inject('datasources.twitter')
    protected dataSource: TwitterDataSource = new TwitterDataSource(),
  ) {}

  value(): Promise<Twitter> {
    return getService(this.dataSource);
  }
}

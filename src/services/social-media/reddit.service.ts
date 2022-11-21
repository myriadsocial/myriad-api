import {inject, Provider} from '@loopback/core';
import {getService} from '@loopback/service-proxy';
import {RedditDataSource} from '../../datasources';

/* eslint-disable  @typescript-eslint/no-explicit-any */
export interface Reddit {
  // this is where you define the Node.js methods that will be
  // mapped to REST/SOAP/gRPC operations as stated in the datasource
  // json file.
  getActions(action: String): Promise<any>;
}

export class RedditProvider implements Provider<Reddit> {
  constructor(
    // reddit must match the name property in the datasource json file
    @inject('datasources.reddit')
    protected dataSource: RedditDataSource = new RedditDataSource(),
  ) {}

  value(): Promise<Reddit> {
    return getService(this.dataSource);
  }
}

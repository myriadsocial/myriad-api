import {inject, Provider} from '@loopback/core';
import {getService} from '@loopback/service-proxy';
import {FacebookDataSource} from '../../datasources';

/* eslint-disable  @typescript-eslint/no-explicit-any */
export interface Facebook {
  // this is where you define the Node.js methods that will be
  // mapped to REST/SOAP/gRPC operations as stated in the datasource
  // json file.
  getActions(pageId: string, postId: string): Promise<any>;
}

export class FacebookProvider implements Provider<Facebook> {
  constructor(
    // facebook must match the name property in the datasource json file
    @inject('datasources.facebook')
    protected dataSource: FacebookDataSource = new FacebookDataSource(),
  ) {}

  value(): Promise<Facebook> {
    return getService(this.dataSource);
  }
}

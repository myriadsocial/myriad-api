import {inject, Provider} from '@loopback/core';
import {getService} from '@loopback/service-proxy';
import {YouTubeDataSource} from '../../datasources';

/* eslint-disable  @typescript-eslint/no-explicit-any */
export interface Youtube {
  getVideos(part: string, id: string): Promise<any>;
  search(part: string, q: string, type: string): Promise<any>;
  // this is where you define the Node.js methods that will be
  // mapped to REST/SOAP/gRPC operations as stated in the datasource
  // json file.
}

export class YouTubeProvider implements Provider<Youtube> {
  constructor(
    // youtube must match the name property in the datasource json file
    @inject('datasources.youtube')
    protected dataSource: YouTubeDataSource = new YouTubeDataSource(),
  ) {}

  value(): Promise<Youtube> {
    return getService(this.dataSource);
  }
}

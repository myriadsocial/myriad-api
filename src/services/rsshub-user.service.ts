import {inject, Provider} from '@loopback/core';
import {getService} from '@loopback/service-proxy';
import {RsshubUserDataSource} from '../datasources';

export interface RsshubUser {
  // this is where you define the Node.js methods that will be
  // mapped to REST/SOAP/gRPC operations as stated in the datasource
  // json file.
  getContents(platform: String, username: String):Promise<any>
}

export class RsshubUserProvider implements Provider<RsshubUser> {
  constructor(
    // rsshubUser must match the name property in the datasource json file
    @inject('datasources.rsshubUser')
    protected dataSource: RsshubUserDataSource = new RsshubUserDataSource(),
  ) {}

  value(): Promise<RsshubUser> {
    return getService(this.dataSource);
  }
}

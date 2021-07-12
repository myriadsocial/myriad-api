import {inject, Provider} from '@loopback/core';
import {getService} from '@loopback/service-proxy';
import {RsshubDataSource} from '../../datasources';

export interface Rsshub {
  // this is where you define the Node.js methods that will be
  // mapped to REST/SOAP/gRPC operations as stated in the datasource
  // json file.
  getContents(username: String): Promise<any>;
}

export class RsshubProvider implements Provider<Rsshub> {
  constructor(
    // rsshub must match the name property in the datasource json file
    @inject('datasources.rsshub')
    protected dataSource: RsshubDataSource = new RsshubDataSource(),
  ) { }

  value(): Promise<Rsshub> {
    return getService(this.dataSource);
  }
}

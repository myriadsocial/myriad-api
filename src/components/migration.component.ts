import {Binding, Component} from '@loopback/core';
import {MigrationBindings} from 'loopback4-migration';
import {MongoDataSource} from '../datasources';
import {UpdateUsers} from '../migrations';
import {User} from '../models';

export class MigrationComponent implements Component {
  bindings: Binding[] = [
    Binding.bind(MigrationBindings.CONFIG).to({
      appVersion: '0.1.0',
      dataSourceName: MongoDataSource.dataSourceName,
      modelName: User.modelName,
      migrationScripts: [UpdateUsers],
    }),
  ];
}

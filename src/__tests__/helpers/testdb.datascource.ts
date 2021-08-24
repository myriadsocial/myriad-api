import {juggler} from '@loopback/repository';

export const testdb: juggler.DataSource = new juggler.DataSource({
  name: 'db',
  connector: 'memory',
});

export const testDBMongo: juggler.DataSource = new juggler.DataSource({
  name: 'mongo',
  connector: 'mongodb',
  url: 'mongodb://myriadsocial:myriadsocial@cluster0-shard-00-00.lxtwh.mongodb.net:27017,cluster0-shard-00-01.lxtwh.mongodb.net:27017,cluster0-shard-00-02.lxtwh.mongodb.net:27017/myriadsocial?ssl=true&replicaSet=atlas-1cludt-shard-0&authSource=admin&retryWrites=true&w=majority',
  host: 'localhost',
  port: 27017,
  user: 'myriadsocial',
  password: 'myriadsocial',
  database: 'myriad',
  allowExtendedOperators: true,
});

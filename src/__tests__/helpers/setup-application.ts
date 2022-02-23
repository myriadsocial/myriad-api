import {
  Client,
  createRestAppClient,
  givenHttpServerConfig,
} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';

export async function setupApplication(
  setMongo?: boolean,
): Promise<AppWithClient> {
  const restConfig = givenHttpServerConfig({
    // Customize the server configuration here.
    // Empty values (undefined, '') will be ignored by the helper.
    //
    // host: process.env.HOST,
    // port: +process.env.PORT,
  });

  const app = new MyriadApiApplication({
    rest: restConfig,
    test: true,
  });

  await app.boot();

  if (setMongo) {
    app.bind('datasources.config.mongo').to({
      name: 'mongo',
      connector: 'mongodb',
      url: 'mongodb://myriadsocial:myriadsocial@cluster0-shard-00-00.lxtwh.mongodb.net:27017,cluster0-shard-00-01.lxtwh.mongodb.net:27017,cluster0-shard-00-02.lxtwh.mongodb.net:27017/myriadsocial?ssl=true&replicaSet=atlas-1cludt-shard-0&authSource=admin&retryWrites=true&w=majority',
      host: 'localhost',
      port: 27017,
      user: 'myriadsocial',
      password: 'myriadsocial',
      database: 'myriad',
      allowExtendedOperators: true,
      test: true,
    });
  } else {
    app.bind('datasources.config.mongo').to({
      name: 'mongo',
      connector: 'memory',
    });
  }

  app.bind('datasources.config.redis').to({
    name: 'redis',
    connector: 'kv-memory',
  });

  await app.start();

  const client = createRestAppClient(app);

  return {app, client};
}

export interface AppWithClient {
  app: MyriadApiApplication;
  client: Client;
}

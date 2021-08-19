import {Client, createRestAppClient, givenHttpServerConfig} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';

export async function setupApplication(): Promise<AppWithClient> {
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

  app.bind('datasources.config.mongo').to({
    name: 'mongo',
    connector: 'memory',
  });

  await app.start();

  const client = createRestAppClient(app);

  return {app, client};
}

export interface AppWithClient {
  app: MyriadApiApplication;
  client: Client;
}

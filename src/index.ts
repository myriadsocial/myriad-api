import {ApplicationConfig, MyriadApiApplication} from './application';
import {config} from './config';

export * from './application';

export async function main(options: ApplicationConfig = {}) {
  const app = new MyriadApiApplication(options);
  await app.boot();
  await app.start();

  const url = app.restServer.url;
  console.log(`Server is running at ${url}`);
  return app;
}

if (require.main === module) {
  // Run the application
  const appConfig = {
    rest: {
      host: config.APPLICATION_HOST,
      port: config.APPLICATION_PORT,
      // The `gracePeriodForClose` provides a graceful close for http/https
      // servers with keep-alive clients. The default value is `Infinity`
      // (don't force-close). If you want to immediately destroy all sockets
      // upon stop, set its value to `0`.
      // See https://www.npmjs.com/package/stoppable
      gracePeriodForClose: 5000, // 5 seconds
      openApiSpec: {
        // useful when used with OpenAPI-to-GraphQL to locate your application
        setServersFromRequest: true,
      },
      expressSettings: {
        'trust proxy': true,
        'x-powered-by': false,
      },
    },
  };
  main(appConfig).catch(err => {
    console.error('Cannot start the application.', err);
    process.exit(1);
  });
}

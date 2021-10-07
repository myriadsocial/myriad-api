import {ApplicationConfig, ExpressServer} from './application';
// import {config} from './config';
export * from './application';

export async function main(options: ApplicationConfig = {}) {
  const server = new ExpressServer(options);
  await server.boot();
  await server.start();
  console.log('Server is running at http://127.0.0.1:3000');
}

if (require.main === module) {
  const config = {
    rest: {
      //TODO: should be able to set port the same as express here but keep PORT IN USE error
      port: +(process.env.PORT ?? 3000),
      // port: 3001,
      host: process.env.HOST ?? 'localhost',
      openApiSpec: {
        // useful when used with OpenAPI-to-GraphQL to locate your application
        setServersFromRequest: true,
      },
      // Use the LB4 application as a route. It should not be listening.
      listenOnStart: false,
    },
  };
  main(config).catch(err => {
    console.error('Cannot start the application.', err);
    process.exit(1);
  });
}

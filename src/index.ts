import {ApplicationConfig, MyriadApiApplication} from './application';
import {config} from './config';
import {LoggingBindings, WinstonLoggerOptions, 
  WINSTON_FORMAT, WINSTON_TRANSPORT,
  WinstonFormat,
  WinstonTransports
} from '@loopback/logging';
import {format} from 'winston';
import {extensionFor} from '@loopback/core';

export * from './application';

export async function main(options: ApplicationConfig = {}) {
  const app = new MyriadApiApplication(options);
  app.configure(LoggingBindings.COMPONENT).to({
    enableFluent: false,
    enableHttpAccessLog: true,
  });

  app.configure<WinstonLoggerOptions>(LoggingBindings.WINSTON_LOGGER).to({
    level: 'info',
    format: format.json(),
    defaultMeta: {framework: 'LoopBack'},
  });

  const myFormat: WinstonFormat = format((info, opts) => {
    console.log(info);
    return false;
  })();
  
  app
    .bind('logging.winston.formats.myFormat')
    .to(myFormat)
    .apply(extensionFor(WINSTON_FORMAT));
    app
    .bind('logging.winston.formats.colorize')
    .to(format.colorize())
    .apply(extensionFor(WINSTON_FORMAT));
  
  const consoleTransport = new WinstonTransports.Console({
    level: 'info',
    format: format.combine(format.colorize(), format.simple()),
  });
  app
    .bind('logging.winston.transports.console')
    .to(consoleTransport)
    .apply(extensionFor(WINSTON_TRANSPORT));
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
    },
  };
  main(appConfig).catch(err => {
    console.error('Cannot start the application.', err);
    process.exit(1);
  });
}

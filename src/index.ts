import {ApplicationConfig, MyriadApiApplication} from './application';
import {polkadotApi} from './helpers/polkadotApi'

export * from './application';

export async function main(options: ApplicationConfig = {}) {
  const app = new MyriadApiApplication(options);
  await app.boot();
  await app.start();

  const url = app.restServer.url;
  console.log(`Server is running at ${url}`);

  try {
    const api = await polkadotApi()
    await api.isReady

    console.log(`RPC isReady`);

    // Subscribe to system events via storage
    api.query.system.events((events) => {
      // Loop through the Vec<EventRecord>
      events.forEach((record) => {
        // Extract the phase, event and the event types
        const {event} = record;

        // Show what we are busy with
        if (event.section == 'balances' && event.method == 'Transfer') {
          console.log(`From: ${event.data[0]}`);
          console.log(`To: ${event.data[1].toString()}`);
          console.log(`Value: ${event.data[2].toString()}`);
        }
      });
    });
  } catch (err) {
    console.log(err, 'hello')
  }


  return app;
}

if (require.main === module) {
  // Run the application
  const config = {
    rest: {
      port: +(process.env.PORT ?? 3001),
      host: process.env.HOST,
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
  main(config).catch(err => {
    console.error('Cannot start the application.', err);
    process.exit(1);
  });
}

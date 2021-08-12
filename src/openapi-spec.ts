import {ApplicationConfig} from '@loopback/core';
import {MyriadApiApplication} from './application';
import {config} from './configs';

/**
 * Export the OpenAPI spec from the application
 */
async function exportOpenApiSpec(): Promise<void> {
  const myriadConfig: ApplicationConfig = {
    rest: {
      port: config.APPLICATION_PORT,
      host: config.APPLICATION_HOST,
    },
  };
  const outFile = process.argv[2] ?? '';
  const app = new MyriadApiApplication(myriadConfig);
  await app.boot();
  await app.exportOpenApiSpec(outFile);
}

exportOpenApiSpec().catch(err => {
  console.error('Fail to export OpenAPI spec from the application.', err);
  process.exit(1);
});

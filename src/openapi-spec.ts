import {ApplicationConfig} from '@loopback/core';
import {MyriadApiApplication} from './application';
import {application} from './configs';

/**
 * Export the OpenAPI spec from the application
 */
async function exportOpenApiSpec(): Promise<void> {
  const config: ApplicationConfig = {
    rest: {
      port: application.port,
      host: application.host,
    },
  };
  const outFile = process.argv[2] ?? '';
  const app = new MyriadApiApplication(config);
  await app.boot();
  await app.exportOpenApiSpec(outFile);
}

exportOpenApiSpec().catch(err => {
  console.error('Fail to export OpenAPI spec from the application.', err);
  process.exit(1);
});

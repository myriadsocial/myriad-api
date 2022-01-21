import {MyriadApiApplication} from './application';

export async function migrate(args: string[]) {
  const existingSchema = args.includes('--rebuild') ? 'drop' : 'alter';
  const envIndex = args.indexOf('--environment');
  const environment = args.includes('--environment')
    ? args[envIndex + 1]
      ? args[envIndex + 1]
      : 'development'
    : undefined;
  const alterIndex = args.indexOf('--alter');
  const alter = args.includes('--alter') ? args[alterIndex + 1].split(',') : [];
  const dropIndex = args.indexOf('--drop');
  const drop = args.includes('--drop') ? args[dropIndex + 1].split(',') : [];
  console.log('Migrating schemas (%s existing schema)', existingSchema);

  const app = new MyriadApiApplication({
    environment,
    alter,
    drop,
  });
  await app.boot();
  await app.migrateSchema({existingSchema});

  // Connectors usually keep a pool of opened connections,
  // this keeps the process running even after all work is done.
  // We need to exit explicitly.
  process.exit(0);
}

migrate(process.argv).catch(err => {
  console.error('Cannot migrate database schema', err);
  process.exit(1);
});

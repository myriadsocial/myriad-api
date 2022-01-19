import {MyriadApiApplication} from './application';

export async function migrate(args: string[]) {
  const existingSchema = args.includes('--rebuild') ? 'drop' : 'alter';
  const envIndex = args.indexOf('--environment');
  const environment = args.includes('--environment')
    ? args[envIndex + 1]
      ? args[envIndex + 1]
      : 'development'
    : undefined;
  const initialUser = args.includes('user');
  const nonce = args.includes('nonce');
  const post = args.includes('post');
  const remove = args.includes('remove');
  const wallet = args.includes('wallet');
  console.log('Migrating schemas (%s existing schema)', existingSchema);

  const app = new MyriadApiApplication({
    environment,
    user: initialUser,
    nonce,
    post,
    remove,
    wallet,
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

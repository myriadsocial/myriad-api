import dotenv from 'dotenv';
dotenv.config();

export const config = {
  APPLICATION_HOST: process.env.HOST ?? 'localhost',
  APPLICATION_PORT: +(process.env.PORT ?? 3000),

  MYRIAD_RPC_WS_URL: process.env.MYRIAD_RPC_WS_URL ?? 'ws://127.0.0.1:9944',
  MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY:
    process.env.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY ??
    '0x48c145fb4a5aeb32075023a576180107ecc1e5470ab2ebdd1965b71a33dad363',
  MYRIAD_FAUCET_MNEMONIC:
    process.env.MYRIAD_FAUCET_MNEMONIC ??
    'bottom drive obey lake curtain smoke basket hold race lonely fit walk//Alice',
  MYRIAD_REWARD_AMOUNT: +(process.env.MYRIAD_REWARD_AMOUNT ?? 0),
  MYRIAD_ESCROW_SECRET_KEY: !process.env.MYRIAD_ESCROW_SECRET_KEY
    ? 's3cr3+<3y'
    : process.env.MYRIAD_ESCROW_SECRET_KEY,

  JWT_TOKEN_SECRET_KEY: !process.env.JWT_TOKEN_SECRET_KEY
    ? 'tok3n'
    : process.env.JWT_TOKEN_SECRET_KEY,
  JWT_TOKEN_EXPIRES_IN: process.env.JWT_TOKEN_EXPIRES_IN ?? '36000',
  JWT_REFRESH_TOKEN_SECRET_KEY:
    process.env.JWT_REFRESH_TOKEN_SECRET_KEY ?? 'r3fr35htok3n',
  JWT_REFRESH_TOKEN_EXPIRES_IN:
    process.env.JWT_REFRESH_TOKEN_EXPIRES_IN ?? '216000',

  MONGO_PROTOCOL: process.env.MONGO_PROTOCOL ?? 'mongodb',
  MONGO_HOST: process.env.MONGO_HOST ?? 'localhost',
  MONGO_PORT: +(process.env.MONGO_PORT ?? 27017),
  MONGO_USER: process.env.MONGO_USER ?? 'api',
  MONGO_PASSWORD: process.env.MONGO_PASSWORD ?? 'passw0rd',
  MONGO_DATABASE: process.env.MONGO_DATABASE ?? 'myriad',
  MONGO_URL: process.env.MONGO_URL ?? '',

  REDIS_CONNECTOR: process.env.REDIS_CONNECTOR ?? 'kv-memory',
  REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
  REDIS_PORT: +(process.env.REDIS_PORT ?? 6379),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD ?? 'passw0rd',

  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET ?? '',

  SENTRY_DSN: process.env.SENTRY_DSN ?? '',

  TWITTER_API_KEY: process.env.TWITTER_API_KEY ?? '',

  COIN_MARKET_CAP_API_KEY: process.env.COIN_MARKET_CAP_API_KEY ?? '',
};

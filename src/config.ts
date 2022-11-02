import dotenv from 'dotenv';
dotenv.config();

export const config = {
  APPLICATION_HOST: process.env.HOST ?? 'localhost',
  APPLICATION_PORT: +(process.env.PORT ?? 3000),

  MYRIAD_ADMIN_SUBSTRATE_MNEMONIC:
    process.env.MYRIAD_SUBSTRATE_MNEMONIC ??
    'bottom drive obey lake curtain smoke basket hold race lonely fit walk//Alice',

  MYRIAD_ADMIN_NEAR_MNEMONIC:
    process.env.MYRIAD_NEAR_MNEMONIC ??
    'bottom drive obey lake curtain smoke basket hold race lonely fit walk',

  MYRIAD_ADMIN_ETHEREUM_MNEMONIC:
    process.env.MYRIAD_ETHEREUM_MNEMONIC ??
    'bottom drive obey lake curtain smoke basket hold race lonely fit walk',

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

  SMTP_SERVER: process.env.SMTP_SERVER ?? 'smtp.ethereal.email',
  SMTP_PORT: +(process.env.SMTP_PORT ?? 587),
  SMTP_USERNAME: process.env.SMTP_USERNAME ?? '',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD ?? '',
  SMTP_SENDER_ADDRESS: process.env.SMTP_SENDER_ADDRESS ?? '',

  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET ?? '',

  STORAGE_URL: process.env.STORAGE_URL ?? '',

  SENTRY_DSN: process.env.SENTRY_DSN ?? '',

  TWITTER_API_KEY: process.env.TWITTER_API_KEY ?? '',

  COIN_MARKET_CAP_API_KEY: process.env.COIN_MARKET_CAP_API_KEY ?? '',
};

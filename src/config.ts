import dotenv from 'dotenv';
dotenv.config();

export const config = {
  APPLICATION_HOST: process.env.HOST ?? 'localhost',
  APPLICATION_PORT: +(process.env.PORT ?? 3000),

  MYRIAD_WS_RPC: process.env.MYRIAD_WS_RPC ?? 'ws://127.0.0.1:9944',
  MYRIAD_MNEMONIC:
    process.env.MYRIAD_FAUCET_MNEMONIC ??
    'bottom drive obey lake curtain smoke basket hold race lonely fit walk//Alice',
  MYRIAD_REWARD_AMOUNT: +(process.env.MYRIAD_REWARD_AMOUNT ?? 0),

  MYRIAD_OFFICIAL_ACCOUNT:
    process.env.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY ??
    '0xa19be5cc8982772e277c259aeb21877c8ac38afe7e4a004f0f05589c255a9b9e',

  MYRIAD_ESCROW_SECRET_KEY: !process.env.MYRIAD_ESCROW_SECRET_KEY
    ? 's3cr3+<3y'
    : process.env.MYRIAD_ESCROW_SECRET_KEY,

  MONGO_HOST: process.env.MONGO_HOST,
  MONGO_PORT: parseInt(process.env.MONGO_PORT ?? ''),
  MONGO_USER: process.env.MONGO_USER ?? 'api',
  MONGO_PASSWORD: process.env.MONGO_PASSWORD ?? 'passw0rd',
  MONGO_DATABASE: process.env.MONGO_DATABASE ?? 'myriad',

  JWT_REFRESH_SECRET_KEY:
    process.env.JWT_REFRESH_TOKEN_SECRET_KEY ?? 'r3fr35htok3n',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN ?? '216000',
  JWT_TOKEN_EXPIRES_IN: process.env.JWT_TOKEN_EXPIRES_IN ?? '36000',
  JWT_TOKEN_SECRET_KEY: !process.env.JWT_TOKEN_SECRET_KEY
    ? 'tok3n'
    : process.env.JWT_TOKEN_SECRET_KEY,

  JWT_EMAIL: !process.env.JWT_EMAIL ? 'admin@mail.com' : process.env.JWT_EMAIL,

  FIREBAE_STORAGE_BUCKET: process.env.FIREBAE_STORAGE_BUCKET ?? '',

  SENTRY_DSN: process.env.SENTRY_DSN ?? '',

  TWITTER_API_KEY: process.env.TWITTER_API_KEY ?? '',

  COIN_MARKET_CAP_API_KEY: process.env.COIN_MARKET_CAP_API_KEY ?? '',
};

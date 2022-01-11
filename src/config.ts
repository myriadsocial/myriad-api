import dotenv from 'dotenv';
dotenv.config();

export const config = {
  APPLICATION_HOST: process.env.HOST ?? 'localhost',
  APPLICATION_PORT: +(process.env.PORT ?? 3000),

  MYRIAD_RPC_WS_URL: process.env.MYRIAD_RPC_WS_URL ?? 'ws://127.0.0.1:9944',
  MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY:
    process.env.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY ??
    '0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d',
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
  JWT_EMAIL: !process.env.JWT_EMAIL ? 'admin@mail.com' : process.env.JWT_EMAIL,

  MONGO_HOSTS: process.env.MONGO_HOSTS ?? '',
  MONGO_USER: process.env.MONGO_USER ?? 'api',
  MONGO_PASSWORD: process.env.MONGO_PASSWORD ?? 'passw0rd',
  MONGO_DATABASE: process.env.MONGO_DATABASE ?? 'myriad',

  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET ?? '',

  SENTRY_DSN: process.env.SENTRY_DSN ?? '',

  TWITTER_API_KEY: process.env.TWITTER_API_KEY ?? '',

  COIN_MARKET_CAP_API_KEY: process.env.COIN_MARKET_CAP_API_KEY ?? '',
};

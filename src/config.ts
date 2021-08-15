require('dotenv').config();

export const config = {
  MONGO_HOST: process.env.MONGO_HOST,
  MONGO_PORT: parseInt(process.env.MONGO_PORT ?? ''),
  MONGO_USER: process.env.MONGO_USER,
  MONGO_PASSWORD: process.env.MONGO_PASSWORD,
  MONGO_DATABASE: process.env.MONGO_DATABASE,
  TOKEN_SECRET_KEY: process.env.TOKEN_SECRET_KEY ?? 'tok3n',
  TOKEN_EXPIRES_IN: process.env.TOKEN_EXPIRES_IN ?? '36000',
  REFRESH_SECRET_KEY: process.env.REFRESH_TOKEN_SECRET_KEY ?? 'r3fr35htok3n',
  REFRESH_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN ?? '216000',
  APPLICATION_PORT: +(process.env.PORT ?? 3000),
  APPLICATION_HOST: process.env.HOST ?? 'localhost',
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ?? '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL ?? '',
  FIREBASE_PRIVATE_KEY: (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n') ?? '',
  MYRIAD_WS_RPC: process.env.MYRIAD_WS_RPC ?? 'ws://127.0.0.1:9944',
  MYRIAD_MNEMONIC: process.env.MYRIAD_FAUCET_MNEMONIC ?? '',
  MYRIAD_REWARD_AMOUNT: +(process.env.MYRIAD_REWARD_AMOUNT ?? 0),
  TWITTER_BEARER_TOKEN: 'Bearer ' + process.env.TWITTER_BEARER_TOKEN ?? '',
};

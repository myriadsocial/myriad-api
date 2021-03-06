import dotenv from 'dotenv';
dotenv.config();

export const config = {
  APPLICATION_HOST: process.env.HOST ?? 'localhost',
  APPLICATION_PORT: +(process.env.PORT ?? 3000),

  MYRIAD_WS_RPC: process.env.MYRIAD_WS_RPC ?? 'ws://127.0.0.1:9944',
  MYRIAD_MNEMONIC: process.env.MYRIAD_FAUCET_MNEMONIC ?? '',
  MYRIAD_REWARD_AMOUNT: +(process.env.MYRIAD_REWARD_AMOUNT ?? 0),

  ACALA_AUSD_REWARD_AMOUNT: +(process.env.ACALA_AUSD_REWARD_AMOUNT ?? 0),

  MONGO_HOST: process.env.MONGO_HOST,
  MONGO_PORT: parseInt(process.env.MONGO_PORT ?? ''),
  MONGO_USER: process.env.MONGO_USER,
  MONGO_PASSWORD: process.env.MONGO_PASSWORD,
  MONGO_DATABASE: process.env.MONGO_DATABASE,

  TOKEN_SECRET_KEY: process.env.TOKEN_SECRET_KEY ?? 'tok3n',
  TOKEN_EXPIRES_IN: process.env.TOKEN_EXPIRES_IN ?? '36000',
  REFRESH_SECRET_KEY: process.env.REFRESH_TOKEN_SECRET_KEY ?? 'r3fr35htok3n',
  REFRESH_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN ?? '216000',

  TWITTER_BEARER_TOKEN: 'Bearer ' + process.env.TWITTER_BEARER_TOKEN ?? '',
};

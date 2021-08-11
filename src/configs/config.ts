import {RpcType} from '../enums';
require('dotenv').config();

export const mongo = {
  host: process.env.MONGO_HOST,
  port: parseInt(process.env.MONGO_PORT ?? ''),
  user: process.env.MONGO_USER,
  password: process.env.MONGO_PASSWORD,
  database: process.env.MONGO_DATABASE,
};

export const token = {
  secretKey: process.env.TOKEN_SECRET_KEY ?? '',
  expiresIn: process.env.TOKEN_EXPIRES_IN ?? '36000',
};

export const refresh = {
  secretKey: process.env.REFRESH_TOKEN_SECRET_KEY ?? 'r3fr35htok3n',
  expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN ?? '216000',
};

export const application = {
  port: +(process.env.PORT ?? 3000),
  host: process.env.HOST ?? 'localhost',
};

export const firebase = {
  projectId: process.env.FIREBASE_PROJECT_ID ?? '',
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? '',
  privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n') ?? '',
};

export const myriad = {
  rpcURL: process.env.MYRIAD_WS_RPC ?? RpcType.LOCALRPC,
  mnemonic: process.env.MYRIAD_FAUCET_MNEMONIC ?? '',
  rewardAmount: +(process.env.MYRIAD_REWARD_AMOUNT ?? 0),
};

export const twitterBearerToken = 'Bearer ' + process.env.TWITTER_BEARER_TOKEN ?? '';

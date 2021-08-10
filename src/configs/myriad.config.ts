import {RpcType} from '../enums';

export const myriad = {
  rpcURL: process.env.MYRIAD_WS_RPC ?? RpcType.LOCALRPC,
  mnemonic: process.env.MYRIAD_FAUCET_MNEMONIC ?? '',
  rewardAmount: +(process.env.MYRIAD_REWARD_AMOUNT ?? 0),
};

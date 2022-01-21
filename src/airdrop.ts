import {BN} from '@polkadot/util';
import {AnyObject} from '@loopback/repository';
import path from 'path';
import {readFileSync} from 'fs';
import * as inquirer from 'inquirer';
import * as log4js from 'log4js';
import {PolkadotJs} from './utils/polkadotJs-utils';

export async function airdrop() {
  log4js.configure({
    appenders: {
      file: {
        type: 'file',
        filename: 'airdrop.txt',
        layout: {type: 'messagePassThrough'},
      },
      out: {type: 'stdout', layout: {type: 'messagePassThrough'}},
    },
    categories: {default: {appenders: ['out', 'file'], level: 'info'}},
  });
  const logger = log4js.getLogger('file');

  const {
    polkadotApi,
    getSystemParameters,
    getKeyring,
    publicKeyToString,
    addressToPublicKey,
  } = new PolkadotJs();

  await inquirer
    .prompt([
      {
        type: 'input',
        message: 'Enter RPC address',
        name: 'rpcAddress',
        default() {
          return 'ws://localhost:9944';
        },
      },
    ])
    .then(async answers => {
      const rpcAddress: string = answers.rpcAddress;

      logger.info('NETWORK PROPERTIES');
      const api = await polkadotApi(rpcAddress);
      const {chainName, chainType, genesisHash, ss58Format, symbols, decimals} =
        await getSystemParameters(api);
      const tokenSymbol = symbols[0];
      const tokenDecimal = Number(decimals[0]);
      logger.info(`\tRPC URL        : ${rpcAddress}`);
      logger.info(`\tChain Name     : ${chainName}`);
      logger.info(`\tChain Type     : ${chainType}`);
      logger.info(`\tGenesis Hash   : ${genesisHash}`);
      logger.info(`\tAddress Prefix : ${ss58Format}`);
      logger.info(`\tToken Symbol   : ${tokenSymbol}`);
      logger.info(`\tToken Decimal  : ${tokenDecimal}`);

      return Promise.resolve({api, tokenSymbol, tokenDecimal});
    })
    .then(async ({api, tokenSymbol, tokenDecimal}) => {
      return inquirer
        .prompt([
          {
            type: 'password',
            message: 'Enter sender mnemonic',
            name: 'mnemonic',
            default() {
              return 'bottom drive obey lake curtain smoke basket hold race lonely fit walk//Alice';
            },
          },
        ])
        .then(async answers => {
          const mnemonic: string = answers.mnemonic;

          logger.info(`SENDER PROPERTIES`);
          const from = getKeyring().addFromMnemonic(mnemonic);
          logger.info(
            `\tPublic Hex     : ${publicKeyToString(from.publicKey)}`,
          );
          logger.info(`\tPublic Address : ${from.address}`);

          return Promise.resolve({api, from, tokenSymbol, tokenDecimal});
        });
    })
    .then(async ({api, from, tokenSymbol, tokenDecimal}) => {
      return inquirer
        .prompt([
          {
            type: 'input',
            message: 'Enter source file path',
            name: 'sourceFilePath',
            default() {
              return '../docs/airdrop/leaderboard-snapshot.json';
            },
          },
        ])
        .then(async answers => {
          const sourceFilePath: string = answers.sourceFilePath;

          logger.info(`RECEIVERS PROPERTIES`);
          const filePath = path.join(__dirname, sourceFilePath);
          const content = readFileSync(filePath);
          const receivers: AnyObject[] = JSON.parse(content.toString());
          let totalAirdrop = 0;
          for (const receiver of receivers) {
            totalAirdrop += receiver.reward;
          }
          logger.info(`\tSource from    : ${sourceFilePath}`);
          logger.info(`\tTotal receiver : ${receivers.length} accounts`);
          logger.info(`\tTotal airdrop  : ${totalAirdrop} ${tokenSymbol}`);

          return Promise.resolve({
            api,
            from,
            tokenSymbol,
            tokenDecimal,
            receivers,
          });
        });
    })
    .then(async ({api, from, tokenSymbol, tokenDecimal, receivers}) => {
      return inquirer
        .prompt([
          {
            type: 'confirm',
            message: 'Send now?',
            name: 'send',
            default() {
              return false;
            },
          },
        ])
        .then(async answers => {
          const send: boolean = answers.send;

          if (!answers.send) return Promise.resolve({send, api});

          for (const receiver of receivers) {
            const to = receiver.publicKey;
            const amount = receiver.reward;

            logger.info(`\nTransfer info`);
            const {nonce} = await api.query.system.account(from.address);
            const transfer = api.tx.balances.transfer(
              to,
              new BN(amount).mul(new BN((1 * 10 ** tokenDecimal).toString())),
            );
            const {partialFee} = await transfer.paymentInfo(from);
            logger.info(`\tPublicHex     : ${to}`);
            logger.info(`\tPublicAddress : ${addressToPublicKey(to)}`);
            logger.info(`\tAmount        : ${amount} ${tokenSymbol}`);
            logger.info(`\tNonce         : ${nonce}`);
            logger.info(`\tFee           : ${partialFee.toHuman()}`);

            await new Promise((resolve, reject) => {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              transfer.signAndSend(from, (result: AnyObject) => {
                if (result.status.isInBlock) {
                  const blockHash = result.status.asInBlock.toHex();
                  logger.info(`\tBlock hash    : ${blockHash}`);
                } else if (result.status.isFinalized) {
                  const blockHash = result.status.asFinalized.toHex();
                  logger.info(`\tFinalized     : ${blockHash}`);
                  resolve(blockHash);
                } else if (result.isError) {
                  logger.info(`\tFinalized     : null`);
                  reject();
                }
              });
            });
          }

          return Promise.resolve({send, api});
        });
    })
    .then(async ({send, api}) => {
      await api.disconnect();
      logger.info(send ? `Transfered` : `Canceled`);
      process.exit(0);
    });
}

airdrop().catch(err => {
  console.error('Airdrop failed', err);
  process.exit(1);
});

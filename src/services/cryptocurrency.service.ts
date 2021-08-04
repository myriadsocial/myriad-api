import {options} from '@acala-network/api';
import {service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {ApiPromise, WsProvider} from '@polkadot/api';
import {ApiOptions} from '@polkadot/api/types';
import {DefaultCryptocurrencyType, RpcType} from '../enums';
import {PolkadotJs} from '../helpers/polkadotJs-utils';
import {PaymentInfo} from '../interfaces';
import {Transaction, TransactionHistory, UserCredential, UserCryptocurrency} from '../models';
import {
  CryptocurrencyRepository,
  PeopleRepository,
  QueueRepository,
  TransactionHistoryRepository,
  TransactionRepository,
  UserCredentialRepository,
  UserCryptocurrencyRepository,
  UserRepository,
} from '../repositories';
import {TransactionService} from './transaction.service';

export class CryptocurrencyService {
  constructor(
    @repository(CryptocurrencyRepository)
    protected cryptocurrencyRepository: CryptocurrencyRepository,
    @repository(UserCryptocurrencyRepository)
    public userCryptocurrencyRepository: UserCryptocurrencyRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(UserCredentialRepository)
    protected userCredentialRepository: UserCredentialRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
    @repository(QueueRepository)
    protected queueRepository: QueueRepository,
    @repository(TransactionHistoryRepository)
    protected transactionHistoryRepository: TransactionHistoryRepository,
    @service(TransactionService)
    protected transactionService: TransactionService,
  ) {}

  async defaultCryptocurrency(userId: string): Promise<void> {
    const cryptocurrencies = [
      {
        id: DefaultCryptocurrencyType.MYR,
        name: 'myriad',
        decimal: 12,
        image: 'https://pbs.twimg.com/profile_images/1407599051579617281/-jHXi6y5_400x400.jpg',
        addressFormat: 214,
        rpcAddress: process.env.MYRIAD_WS_RPC ?? RpcType.LOCALRPC,
        isNative: true,
      },
      {
        id: DefaultCryptocurrencyType.AUSD,
        name: 'ausd',
        decimal: 12,
        image: 'https://apps.acala.network/static/media/AUSD.439bc3f2.png',
        addressFormat: 42,
        rpcAddress: 'wss://acala-mandala.api.onfinality.io/public-ws',
        isNative: false,
      },
    ];

    for (const cryptocurrency of cryptocurrencies) {
      try {
        await this.userRepository.cryptocurrencies(userId).create(cryptocurrency);
      } catch {
        this.userCryptocurrencyRepository.create({
          userId: userId,
          cryptocurrencyId: cryptocurrency.id,
        }) as Promise<UserCryptocurrency>;
      }
    }
  }

  async defaultAcalaTips(userId: string): Promise<void> {
    try {
      const rpcAddress = 'wss://acala-mandala.api.onfinality.io/public-ws';
      const provider = new WsProvider(rpcAddress);
      const api = await new ApiPromise(options({provider}) as ApiOptions).isReadyOrError;
      const {getKeyring, getHexPublicKey} = new PolkadotJs();

      const mnemonic = process.env.MYRIAD_FAUCET_MNEMONIC ?? '';
      const from = getKeyring().addFromMnemonic(mnemonic);
      const to = userId;
      const acalaDecimal = 12;
      const value = 10 * 10 ** acalaDecimal;

      const {nonce} = await api.query.system.account(from.address);

      const queue = await this.queueRepository.findOne({
        where: {
          id: 'acala',
        },
      });

      let priority: number = nonce.toJSON();

      if (!queue) {
        await this.queueRepository.create({
          id: 'acala',
          priority: priority + 1,
        });
      } else {
        if (queue.priority >= nonce.toJSON()) {
          priority = queue.priority;
        } else {
          priority = nonce.toJSON();
        }

        await this.queueRepository.updateById(queue.id, {priority: priority + 1});
      }

      const transfer = api.tx.currencies.transfer(
        to,
        {Token: DefaultCryptocurrencyType.AUSD},
        value,
      );
      const txHash = await transfer.signAndSend(from, {nonce: priority});

      this.transactionRepository.create({
        trxHash: txHash.toString(),
        from: getHexPublicKey(from),
        to: userId,
        value: 10,
        state: 'success',
        hasSentToUser: true,
        createdAt: new Date().toString(),
        cryptocurrencyId: DefaultCryptocurrencyType.AUSD,
      }) as Promise<Transaction>;

      this.transactionHistoryRepository.create({
        sentToMe: 10,
        sentToThem: 0,
        createdAt: new Date().toString(),
        updatedAt: new Date().toString(),
        userId: userId,
        cryptocurrencyId: DefaultCryptocurrencyType.AUSD,
      }) as Promise<TransactionHistory>;

      await api.disconnect();
    } catch {}
  }

  async isUserHasCrypto(userId: string, cryptocurrencyId: string): Promise<void> {
    cryptocurrencyId = cryptocurrencyId.toUpperCase();

    // Check if token exist in database
    const foundCryptocurrency = await this.cryptocurrencyRepository.findById(cryptocurrencyId);

    if (!foundCryptocurrency) {
      throw new HttpErrors.NotFound('Cryptocurrency not found. Please add crypto first!');
    }

    // Check if user already has the crypto
    const userCryptocurrency = await this.userCryptocurrencyRepository.findOne({
      where: {
        userId: userId,
        cryptocurrencyId: cryptocurrencyId,
      },
    });

    if (userCryptocurrency) {
      throw new HttpErrors.UnprocessableEntity('You already have this token');
    }
  }

  async claimTips(credential: UserCredential): Promise<void> {
    const {userId, peopleId} = credential;
    const {getKeyring, getHexPublicKey} = new PolkadotJs();

    const from = getKeyring(process.env.MYRIAD_CRYPTO_TYPE).addFromUri('//' + peopleId);
    const to = userId; // Sending address

    // Get the total tips, store in people
    const foundPeople = await this.peopleRepository.findOne({
      where: {id: peopleId},
      include: [
        {
          relation: 'personTips',
          scope: {
            where: {
              total: {gt: 0},
            },
            include: [{relation: 'cryptocurrency'}],
          },
        },
      ],
    });

    const foundTips = foundPeople ? foundPeople.personTips : null;

    if (foundTips) {
      let initRpcAddress = null;
      let api = null;

      const tips = foundTips;

      for (const tip of tips) {
        const {
          id: tipId,
          total: total,
          cryptocurrency: {rpcAddress, isNative, decimal, id: cryptocurrencyId},
        } = tip;

        // Set crypto api
        if (!api || initRpcAddress !== rpcAddress) {
          initRpcAddress = rpcAddress;
          api = await this.cryptoApi(initRpcAddress, cryptocurrencyId);
        }

        const paymentInfo = {
          total: total * 10 ** decimal,
          to,
          from,
          cryptocurrencyId,
          decimal,
          isNative,
          fromString: getHexPublicKey(from),
          txFee: 0,
          nonce: 0,
          tipId,
          txHash: '',
        };
        const txFee = await this.getTransactionFee(api, paymentInfo); // Tx fee estimation

        paymentInfo.txFee = txFee;

        // Get txHash if transaction is succeed
        const txHash = await this.sendTipsToUser(api, paymentInfo);

        paymentInfo.txHash = txHash;
        paymentInfo.txFee = paymentInfo.txFee / 10 ** decimal;

        // Record transaction
        this.transactionService.recordTransaction(paymentInfo) as Promise<void>;
      }

      if (api !== null) await api.disconnect();
    }
  }

  async sendMyriadReward(userId: string): Promise<void> {
    const {
      rpcAddress: myriadRpc,
      addressFormat: myriadPrefix,
      decimal: myriadDecimal,
      isNative,
    } = await this.cryptocurrencyRepository.findById(DefaultCryptocurrencyType.MYR);

    const {polkadotApi, getKeyring, getHexPublicKey} = new PolkadotJs(myriadRpc);
    const api = await polkadotApi();

    const mnemonic = process.env.MYRIAD_FAUCET_MNEMONIC ?? '';

    const from = getKeyring(process.env.MYRIAD_CRYPTO_TYPE, myriadPrefix).addFromMnemonic(mnemonic);
    const to = userId;

    const reward = +(process.env.MYRIAD_REWARD_AMOUNT ?? 0) * 10 ** myriadDecimal;

    const {nonce} = await api.query.system.account(from.address);
    const getNonce = await this.getQueueNumber(nonce.toJSON());

    const paymentInfo = {
      total: reward,
      to,
      from,
      cryptocurrencyId: DefaultCryptocurrencyType.MYR,
      isNative,
      nonce: getNonce,
      fromString: getHexPublicKey(from),
      txFee: 0,
      decimal: myriadDecimal,
      txHash: '',
    };

    const txHash = await this.sendTipsToUser(api, paymentInfo);

    paymentInfo.txHash = txHash;
    paymentInfo.total = 1;

    this.transactionService.recordTransaction(paymentInfo) as Promise<void>;

    await api.disconnect();
  }

  async getTransactionFee(cryptoApi: ApiPromise, paymentInfo: PaymentInfo): Promise<number> {
    const {total, to, from, cryptocurrencyId, decimal, isNative} = paymentInfo;

    let txFee = 0;

    if (isNative) {
      const {weight, partialFee} = await cryptoApi.tx.balances
        .transfer(to, Number(total))
        .paymentInfo(from);

      txFee = Math.floor(+weight.toString() + +partialFee.toString());
    } else {
      const cryptoAcaPoolString = (
        await cryptoApi.query.dex.liquidityPool([{Token: 'ACA'}, {Token: cryptocurrencyId}])
      ).toString();

      const cryptoAcaPool = cryptoAcaPoolString
        .substring(1, cryptoAcaPoolString.length - 1)
        .replace(/"/g, '')
        .split(',');

      const crypto = parseInt(cryptoAcaPool[1]) / 10 ** decimal;
      const aca = parseInt(cryptoAcaPool[0]) / 10 ** 13;
      const cryptoPerAca = crypto / aca;

      // Get transaction fee
      const {weight, partialFee} = await cryptoApi.tx.currencies
        .transfer(to, {Token: cryptocurrencyId}, Number(total))
        .paymentInfo(from);

      const txFeeInAca = (+weight.toString() + +partialFee.toString()) / 10 ** 13;

      txFee = Math.floor(txFeeInAca * cryptoPerAca * 10 ** decimal);
    }

    return txFee;
  }

  async sendTipsToUser(cryptoApi: ApiPromise, paymentInfo: PaymentInfo): Promise<string> {
    const {total, to, from, cryptocurrencyId, isNative, txFee, nonce} = paymentInfo;

    let txHash = null;
    let transfer = null;

    if (isNative) {
      transfer = cryptoApi.tx.balances.transfer(to, total - txFee);
    } else {
      transfer = cryptoApi.tx.currencies.transfer(to, {Token: cryptocurrencyId}, total - txFee);
    }

    if (nonce) txHash = await transfer.signAndSend(from, {nonce});
    else txHash = await transfer.signAndSend(from);

    return txHash.toString();
  }

  async cryptoApi(rpcAddress: string, cryptocurrencyId: string): Promise<ApiPromise> {
    let api = null;
    const provider = new WsProvider(rpcAddress);

    if (cryptocurrencyId === 'ACA' || cryptocurrencyId === 'AUSD' || cryptocurrencyId === 'DOT') {
      api = await new ApiPromise(
        options({
          provider,
        }) as ApiOptions,
      ).isReadyOrError;
    } else {
      api = await new ApiPromise({provider}).isReadyOrError;
    }

    return api;
  }

  async getQueueNumber(nonce: number): Promise<number> {
    const foundQueue = await this.queueRepository.findOne({
      where: {
        id: 'admin',
      },
    });

    let priority: number = nonce;

    if (!foundQueue) {
      await this.queueRepository.create({
        id: 'admin',
        priority: priority + 1,
      });
    } else {
      if (foundQueue.priority >= priority) priority = foundQueue.priority;
      else priority = nonce;

      await this.queueRepository.updateById(foundQueue.id, {
        priority: priority + 1,
      });
    }

    return priority;
  }
}

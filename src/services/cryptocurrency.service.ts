import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {UserCredential, UserCrypto} from '../models';
import {ApiPromise, Keyring, WsProvider} from '@polkadot/api';
import {KeypairType} from '@polkadot/util-crypto/types';
import {u8aToHex} from '@polkadot/util';
import {options} from '@acala-network/api';
import {
  CryptocurrencyRepository,
  UserCryptoRepository,
  UserRepository,
  PeopleRepository,
  TransactionRepository,
  QueueRepository,
  UserCredentialRepository,
} from '../repositories';
import {ApiOptions} from '@polkadot/api/types';
import {service} from '@loopback/core';
import {TransactionService} from './transaction.service';
import {DefaultCrypto, RpcType} from '../enums';
import {PaymentInfo} from '../interfaces';

export class CryptocurrencyService {
  constructor(
    @repository(CryptocurrencyRepository)
    protected cryptocurrencyRepository: CryptocurrencyRepository,
    @repository(UserCryptoRepository)
    protected userCryptoRepository: UserCryptoRepository,
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
    @service(TransactionService)
    protected transactionService: TransactionService,
  ) {}

  async defaultCrypto(userId: string): Promise<void> {
    const cryptocurrencies = [
      {
        id: 'MYR',
        name: 'myria',
        decimal: 12,
        image: 'https://pbs.twimg.com/profile_images/1407599051579617281/-jHXi6y5_400x400.jpg',
        addressFormat: 214,
        rpcAddress: process.env.MYRIAD_WS_RPC ?? RpcType.LOCALRPC,
        isNative: true,
      },
      {
        id: 'AUSD',
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
        this.userCryptoRepository.create({
          userId: userId,
          cryptocurrencyId: cryptocurrency.id,
        }) as Promise<UserCrypto>;
      }
    }
  }

  async isUserHasCrypto(userId: string, cryptocurrencyId: string): Promise<void> {
    cryptocurrencyId = cryptocurrencyId.toUpperCase();

    // Check if token exist in database
    const foundCryptocurrency = await this.cryptocurrencyRepository.findById(cryptocurrencyId);

    if (!foundCryptocurrency) {
      throw new HttpErrors.NotFound('Cryptocurrency not found. Please add crypto first!');
    }

    // Check if user already has the crypto
    const foundUserCrypto = await this.userCryptoRepository.findOne({
      where: {
        userId: userId,
        cryptocurrencyId: cryptocurrencyId,
      },
    });

    if (foundUserCrypto) {
      throw new HttpErrors.UnprocessableEntity('You already have this token');
    }
  }

  async claimTips(credential: UserCredential): Promise<void> {
    const {userId, peopleId} = credential;
    const keyring = new Keyring({
      type: process.env.MYRIAD_CRYPTO_TYPE as KeypairType,
    });

    const from = keyring.addFromUri('//' + peopleId);
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
          total,
          to,
          from,
          cryptocurrencyId,
          decimal,
          isNative,
          fromString: u8aToHex(from.publicKey),
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
    } = await this.cryptocurrencyRepository.findById(DefaultCrypto.MYR);
    const api = await this.cryptoApi(myriadRpc, DefaultCrypto.MYR);
    const keyring = new Keyring({
      type: process.env.MYRIAD_CRYPTO_TYPE as KeypairType,
      ss58Format: myriadPrefix,
    });

    const mnemonic = process.env.MYRIAD_FAUCET_MNEMONIC ?? '';
    const from = keyring.addFromMnemonic(mnemonic);
    const to = userId;
    const reward = +(process.env.MYRIAD_REWARD_AMOUNT ?? 0) * 10 ** myriadDecimal;
    const {nonce} = await api.query.system.account(from.address);
    const getNonce = await this.getQueueNumber(nonce.toJSON());

    const paymentInfo = {
      total: reward,
      to,
      from,
      cryptocurrencyId: DefaultCrypto.MYR,
      isNative,
      nonce: getNonce,
      fromString: u8aToHex(from.publicKey),
      txFee: 0,
      decimal: myriadDecimal,
      txHash: '',
    };

    const txHash = await this.sendTipsToUser(api, paymentInfo);

    paymentInfo.txHash = txHash;

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

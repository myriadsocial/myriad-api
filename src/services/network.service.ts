import {AuthenticationBindings} from '@loopback/authentication';
import {BindingScope, inject, injectable} from '@loopback/core';
import {AnyObject, Filter, repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {ApiPromise} from '@polkadot/api';
import type {AccountInfo} from '@polkadot/types/interfaces';
import {BN} from '@polkadot/util';
import {sha256} from 'js-sha256';
import {providers, transactions, utils} from 'near-api-js';
import {config} from '../config';
import {
  Currency,
  CurrencyWithRelations,
  Network,
  Transaction,
  TxDetail,
} from '../models';
import {
  CurrencyRepository,
  NetworkRepository,
  QueueRepository,
  ServerRepository,
  UserSocialMediaRepository,
  WalletRepository,
} from '../repositories';
import {base64ToString, strToJson} from '../utils/formatter';
import {PolkadotJs} from '../utils/polkadot-js';
import {CoinMarketCap} from './coin-market-cap.service';

const nearSeedPhrase = require('near-seed-phrase');

const {polkadotApi, getKeyring} = new PolkadotJs();

interface ClaimReferenceData {
  networkId: string;
  rpcURL: string;
  serverId: string;
  accountId: string;
  txFee: string;
  referenceIds: string[];
  contractId?: string;
}

interface TipsBalanceInfo {
  serverId: string;
  referenceType: string;
  referenceId: string;
  ftIdentifier: string;
}

interface TransactionDetail {
  from: string;
  to: string;
  amount: string;
}

interface HashDetail {
  transactionDetail: TransactionDetail;
  tipsBalanceInfo: TipsBalanceInfo | null | undefined;
  tokenId: string | null | undefined;
}

/* eslint-disable   @typescript-eslint/naming-convention */
@injectable({scope: BindingScope.TRANSIENT})
export class NetworkService {
  constructor(
    @repository(CurrencyRepository)
    private currencyRepository: CurrencyRepository,
    @repository(NetworkRepository)
    private networkRepository: NetworkRepository,
    @repository(QueueRepository)
    private queueRepository: QueueRepository,
    @repository(ServerRepository)
    private serverRepository: ServerRepository,
    @repository(UserSocialMediaRepository)
    private userSocialMediaRepository: UserSocialMediaRepository,
    @repository(WalletRepository)
    private walletRepository: WalletRepository,
    @inject('services.CoinMarketCap')
    private coinMarketCapService: CoinMarketCap,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private currentUser: UserProfile,
  ) {}

  public async find(filter?: Filter<Network>): Promise<Network[]> {
    return this.networkRepository.find(filter);
  }

  public async findById(
    id: string,
    filter?: Filter<Network>,
  ): Promise<Network> {
    return this.networkRepository.findById(id, filter);
  }

  // ------------------------------------------------

  public async transactionHashInfo(
    transaction: Transaction,
    currency: CurrencyWithRelations,
    method?: string,
  ): Promise<HashDetail | void> {
    const {network} = currency;
    if (!network) return;
    const {blockchainPlatform, rpcURL} = network;
    switch (blockchainPlatform) {
      case 'substrate':
        return this.substrateHashDetail(transaction, rpcURL, method);

      case 'near':
        return this.nearHashDetail(transaction, rpcURL, method);

      default:
        return;
    }
  }

  public async claim(txDetail: TxDetail): Promise<Pick<Transaction, 'hash'>> {
    const userId = this.currentUser?.[securityId];
    const txFee = txDetail.txFee;
    const contractId = txDetail.tippingContractId;

    if (!userId) {
      throw new HttpErrors.Forbidden('UnathorizedUser');
    }

    if (parseInt(txFee) === 0) {
      throw new HttpErrors.UnprocessableEntity('TxFeeMustLargerThanZero');
    }

    const wallet = await this.walletRepository.findOne({
      where: {
        userId,
        primary: true,
      },
      include: ['network'],
    });

    if (!wallet?.network) throw new HttpErrors.NotFound('WalletNotFound');

    const [server, socialMedia] = await Promise.all([
      this.serverRepository.findOne(),
      this.userSocialMediaRepository.find({where: {userId}}),
    ]);

    if (!server) throw new HttpErrors.NotFound('ServerNotFound');

    const networkId = wallet.networkId;
    const serverId =
      networkId === 'myriad' || networkId === 'debio'
        ? server?.accountId?.myriad
        : server?.accountId?.[networkId];

    if (!serverId) {
      throw new HttpErrors.UnprocessableEntity('ServerNotExists');
    }

    const accountId = wallet.id;
    const referenceIds = socialMedia.map(e => e.peopleId);
    const claimReferenceData = {
      networkId: networkId,
      rpcURL: wallet.network.rpcURL,
      serverId,
      accountId,
      txFee,
      referenceIds,
      contractId,
    };

    switch (networkId) {
      case 'near':
        return this.claimReferenceNear(claimReferenceData);

      case 'debio':
      case 'myriad':
        return this.claimReferenceSubstrate(claimReferenceData);

      default:
        throw new HttpErrors.NotFound('WalletNotFound');
    }
  }

  // ------------------------------------------------

  // ------ VerifyNetwork ---------------------------

  private async verifyPolkadotConnection(
    network: Network,
  ): Promise<Network | void> {
    const {rpcURL} = network;
    const {getSystemParameters} = new PolkadotJs();
    const api = await this.connect(rpcURL);
    const currencies: AnyObject[] = [];
    const {chainName, symbols, symbolsDecimals} = await getSystemParameters(
      api,
    );

    for (const symbol in symbolsDecimals) {
      const currency = new Currency({
        name: `${chainName}`,
        symbol: symbol,
        decimal: symbolsDecimals[symbol],
        image: 'test',
        native: symbols[0] === symbol ? true : false,
        networkId: chainName.toLowerCase(),
        exchangeRate: false,
      });

      try {
        const {data} = await this.coinMarketCapService.getActions(
          `cryptocurrency/quotes/latest?symbol=${symbol}`,
        );

        const currencyInfo = data[symbol];

        if (
          !currencyInfo.platform &&
          currencyInfo.tags.find((tag: string) => tag === 'substrate')
        ) {
          currency.exchangeRate = true;
        }
      } catch (err) {
        // ignore
      }

      currencies.push(currency);
    }

    Promise.all(
      currencies.map(currency => {
        return this.currencyRepository.create(currency);
      }),
    ) as Promise<AnyObject>;

    await api.disconnect();

    return Object.assign(network, {
      id: chainName.toLowerCase(),
    });
  }

  private async verifyNearContractAddress(
    networkId: string,
    rpcURL: string,
    contractId: string,
  ): Promise<Currency> {
    const currency = new Currency();

    try {
      const provider = new providers.JsonRpcProvider({url: rpcURL});

      const rawResult = await provider.query({
        request_type: 'call_function',
        account_id: contractId,
        method_name: 'ft_metadata',
        args_base64: 'e30=',
        finality: 'optimistic',
      });

      const result = JSON.parse(
        Buffer.from((rawResult as AnyObject).result).toString(),
      );

      currency.name = result.name;
      currency.symbol = result.symbol;
      currency.decimal = result.decimals;
      currency.image = result.icon;
      currency.native = false;
      currency.networkId = networkId;
      currency.exchangeRate = false;
      currency.referenceId = contractId;
    } catch {
      throw new HttpErrors.UnprocessableEntity('Wrong contract id');
    }

    try {
      const {data} = await this.coinMarketCapService.getActions(
        `cryptocurrency/quotes/latest?symbol=${currency.symbol}`,
      );

      const currencyInfo = data[currency.symbol];

      if (
        currencyInfo.tags.find(
          (tag: string) => tag === 'near-protocol-ecosystem',
        ) &&
        !currencyInfo.platform
      ) {
        currency.exchangeRate = true;
      }
    } catch {
      // ignore
    }

    return currency;
  }

  // ------------------------------------------------

  // ------ ClaimReference --------------------------

  private async claimReferenceNear(
    claimReferenceData: ClaimReferenceData,
  ): Promise<Pick<Transaction, 'hash'>> {
    try {
      const {serverId, accountId, rpcURL, txFee, contractId, referenceIds} =
        claimReferenceData;

      const mainReferenceType = 'user';
      const mainReferenceId = this.currentUser[securityId];

      if (!contractId) {
        throw new HttpErrors.UnprocessableEntity('ContractIdEmpty');
      }

      const provider = new providers.JsonRpcProvider({url: rpcURL});
      const tipsBalanceInfo = {
        server_id: serverId,
        reference_type: mainReferenceType,
        reference_id: mainReferenceId,
        ft_identifier: 'native',
      };
      const data = JSON.stringify({tips_balance_info: tipsBalanceInfo});
      const buff = Buffer.from(data);
      const base64data = buff.toString('base64');
      const [{gas_price}, rawResult] = await Promise.all([
        provider.gasPrice(null),
        provider.query({
          request_type: 'call_function',
          account_id: contractId,
          method_name: 'get_tips_balance',
          args_base64: base64data,
          finality: 'final',
        }),
      ]);

      const result = JSON.parse(
        Buffer.from((rawResult as AnyObject).result).toString(),
      );

      const amount = result?.tips_balance?.amount ?? '0';
      const GAS = BigInt(300000000000000);
      const currentTxFee = GAS * BigInt(gas_price);

      if (BigInt(amount) < currentTxFee || BigInt(txFee) < currentTxFee) {
        throw new HttpErrors.UnprocessableEntity('TxFeeInsufficient');
      }

      const mnemonic = config.MYRIAD_ADMIN_NEAR_MNEMONIC;
      const seedData = nearSeedPhrase.parseSeedPhrase(mnemonic);
      const privateKey = seedData.secretKey;
      const keyPair = utils.key_pair.KeyPairEd25519.fromString(privateKey);
      const publicKey = keyPair.getPublicKey();
      const sender = serverId;
      const receiverId = contractId;
      const args = `access_key/${sender}/${publicKey.toString()}`;
      const accessKey = await provider.query(args, '');
      const {nonce, block_hash} = accessKey as AnyObject;
      const recentBlockHash = utils.serialize.base_decode(block_hash);
      const actions = [
        transactions.functionCall(
          'batch_claim_references',
          Buffer.from(
            JSON.stringify({
              reference_type: 'people',
              reference_ids: referenceIds,
              main_ref_type: 'user',
              main_ref_id: this.currentUser[securityId],
              account_id: accountId,
              tx_fee: txFee,
            }),
          ),
          new BN('300000000000000'),
          new BN('1'),
        ),
      ];
      const transaction = transactions.createTransaction(
        sender,
        publicKey,
        receiverId,
        nonce + 1,
        actions,
        recentBlockHash,
      );
      const serializedTx = utils.serialize.serialize(
        transactions.SCHEMA,
        transaction,
      );
      const serializedTxHash = new Uint8Array(sha256.array(serializedTx));
      const signature = keyPair.sign(serializedTxHash);
      const signedTransaction = new transactions.SignedTransaction({
        transaction,
        signature: new transactions.Signature({
          keyType: transaction.publicKey.keyType,
          data: signature.signature,
        }),
      });

      const txHash = await provider.sendTransactionAsync(signedTransaction);

      return {hash: txHash.toString()};
    } catch (err) {
      if (err.type) {
        throw new HttpErrors.UnprocessableEntity(err.type);
      }

      throw err;
    }
  }

  private async claimReferenceSubstrate(
    claimReferenceData: ClaimReferenceData,
  ): Promise<Pick<Transaction, 'hash'>> {
    let api: ApiPromise | null = null;

    try {
      const {serverId, accountId, rpcURL, txFee, referenceIds, networkId} =
        claimReferenceData;

      if (isNaN(Number(txFee))) {
        throw new Error('TxFeeNotANumber');
      }

      const mainReferenceType = 'user';
      const mainReferenceId = this.currentUser[securityId];

      api = await this.connect(rpcURL);

      const rawTipsBalance = await api.query.tipping.tipsBalanceByReference(
        serverId,
        mainReferenceType,
        mainReferenceId,
        'native',
      );

      const stringifyTipsBalance = rawTipsBalance.toString();

      if (!stringifyTipsBalance) {
        throw new Error('TipsBalanceNotFound');
      }

      const tipsBalance = JSON.parse(stringifyTipsBalance);
      const balance = tipsBalance?.amount?.substring(2) ?? '0';
      const mnemonic = config.MYRIAD_ADMIN_SUBSTRATE_MNEMONIC;
      const serverAdmin = getKeyring().addFromMnemonic(mnemonic);
      const currencies = await this.currencyRepository.find({
        where: {
          networkId,
          native: false,
        },
      });

      const ftIdentifierIds = currencies.map(currency => currency.referenceId);
      const {partialFee} = await api.tx.tipping
        .claimReference(
          serverId,
          {referenceType: 'people', referenceIds},
          {referenceType: 'user', referenceIds: [mainReferenceId]},
          ['native', ...ftIdentifierIds],
          accountId,
          new BN('1'),
        )
        .paymentInfo(serverAdmin.address);

      const estimateTxFee = partialFee.toBn();
      const serverAddress = serverAdmin.address;
      const notSufficientBalance = new BN(balance, 'hex').lt(new BN(txFee));
      const notSufficientFee = new BN(txFee).lt(estimateTxFee);

      if (notSufficientBalance || notSufficientFee) {
        throw new Error('TxFeeInsufficient');
      }

      const {nonce: currentNonce} = await api.query.system.account<AccountInfo>(
        serverAddress,
      );

      const nonce = await this.getQueueNumber(
        currentNonce.toJSON(),
        claimReferenceData.serverId,
      );

      const extrinsic = api.tx.tipping.claimReference(
        serverId,
        {referenceType: 'people', referenceIds},
        {referenceType: 'user', referenceIds: [mainReferenceId]},
        ['native', ...ftIdentifierIds],
        accountId,
        new BN(txFee),
      );

      const txHash = await extrinsic.signAndSend(serverAdmin, {nonce});

      return {hash: txHash.toString()};
    } catch (err) {
      throw new HttpErrors.UnprocessableEntity(err.message);
    } finally {
      if (api) await api.disconnect();
    }
  }

  // ------------------------------------------------

  // ------ HashDetail ------------------------------

  private async substrateHashDetail(
    transaction: Transaction,
    rpcURL: string,
    method?: string,
  ): Promise<HashDetail> {
    const api = await this.connect(rpcURL);
    const apiAt = await api.at(transaction.hash).catch(() => null);
    const result = await apiAt?.query.system.events().catch(() => null);

    if (!result) {
      throw new HttpErrors.NotFound('RecordNotFound');
    }

    const records = result.toHuman() as AnyObject[];

    let hashDetail = null;

    for (const record of records) {
      const {event} = record;
      const {method: methodName, data, section} = event;

      if (method && method !== methodName) continue;
      const func = `${section}.${methodName}`;

      switch (func) {
        // SendTip With MYRIA to KNOWN RECEIVER
        // Example: 0xbdca73b63fd7cc0ea023ce9e680f0a8be39a9b2e43de54f1688b65912ce67b16
        case 'balances.Transfer': {
          const {from, to, amount} = data;

          hashDetail = {
            transactionDetail: {from, to, amount: amount.replace(/,/gi, '')},
            tipsBalanceInfo: null,
            tokenId: null,
          };
          break;
        }

        // SendTip With FT to KNOWN RECEIVER
        // Example: 0x3223caecd4db58968bf4d9b038f08a7c6092fbb9cac08fd4c72b33d4e4d1cb2d
        case 'octopusAssets.Transferred': {
          const {assetId, from, to, amount} = data;

          hashDetail = {
            transactionDetail: {from, to, amount: amount.replace(/,/gi, '')},
            tipsBalanceInfo: null,
            tokenId: assetId,
          };
          break;
        }

        // SendTip With MYRIA to UNKNOWN RECEIVER
        // Example: 0x415f477f5c82a0dbacf4750a2394f51b867534ae5c5705ce98f49ae21fea5f58
        case 'tipping.SendTip': {
          const {from, to, tipsBalance} = data;
          const {tipsBalanceInfo, amount} = tipsBalance;
          const {ftIdentifier} = tipsBalanceInfo;

          hashDetail = {
            transactionDetail: {from, to, amount: amount.replace(/,/gi, '')},
            tipsBalanceInfo,
            tokenId: ftIdentifier === 'native' ? null : ftIdentifier,
          };
          break;
        }

        // Pay Content
        case 'tipping.PayUnlockableContent': {
          const {from, to, receipt} = data;
          const {info, amount} = receipt;
          const {ftIdentifier} = info;

          hashDetail = {
            transactionDetail: {from, to, amount: amount.replace(/,/gi, '')},
            tipsBalanceInfo: info,
            tokenId: ftIdentifier === 'native' ? null : ftIdentifier,
          };
          break;
        }

        default:
          continue;
      }
    }

    if (!hashDetail) {
      throw new HttpErrors.UnprocessableEntity('RecordNotFound');
    }

    await api.disconnect();

    return hashDetail;
  }

  private async nearHashDetail(
    transaction: Transaction,
    rpcURL: string,
    method?: string,
  ): Promise<HashDetail> {
    const {hash, from} = transaction;
    const provider = new providers.JsonRpcProvider({url: rpcURL});
    const receipts = await provider.txStatus(hash, from);
    const actions: AnyObject[] = receipts.transaction?.actions ?? [];
    const {receiver_id} = receipts.transaction;

    if (!actions.length || !receiver_id) {
      throw new HttpErrors.UnprocessableEntity('RecordNotFound');
    }

    let hashDetail = null;

    for (const action of actions) {
      for (const key in action) {
        const {args, method_name: methodName} = action[key];

        if (method && method !== methodName) continue;

        switch (methodName) {
          // SendTip With FT to UNKNOWN RECEIVER
          // Example: FG2P7SfAdxWRtb3EPgQpoXxxNiorV6X31MSasYdDT9dy
          case 'ft_transfer_call': {
            const result = base64ToString(args);
            const transactionDetail = strToJson(result);
            if (!transactionDetail) continue;
            const {receiver_id: to, amount, msg} = transactionDetail;
            const tipsBalanceInfo = strToJson(msg);
            if (!tipsBalanceInfo) continue;

            hashDetail = {
              transactionDetail: {from, to, amount},
              tipsBalanceInfo: {
                serverId: tipsBalanceInfo.server_id,
                referenceType: tipsBalanceInfo.reference_type,
                referenceId: tipsBalanceInfo.reference_id,
                ftIdentifier: tipsBalanceInfo.ft_identifier,
              },
              tokenId: receiver_id,
            };
            break;
          }

          // SendTip With NEAR to UNKNOWN RECEIVER
          // Example: BUmxShQYfxSptncSfuZZ1dbAAWhuTtoRryCjiemYWE1E
          case 'send_tip': {
            const result = base64ToString(args);
            const transactionDetail = strToJson(result);
            if (!transactionDetail) continue;
            const {tips_balance_info: tipsBalanceInfo} = transactionDetail;
            const {deposit: amount} = action[key];

            hashDetail = {
              transactionDetail: {from, to: receiver_id, amount},
              tipsBalanceInfo: {
                serverId: tipsBalanceInfo.server_id,
                referenceType: tipsBalanceInfo.reference_type,
                referenceId: tipsBalanceInfo.reference_id,
                ftIdentifier: tipsBalanceInfo.ft_identifier,
              },
              tokenId: null,
            };
            break;
          }

          // SendTip With FT to KNOWN RECEIVER
          // Example: ADWrBEZxSTbmD3FZUky234d6B6YA93R8kKrhBWzMmZ1L
          case 'ft_transfer': {
            const result = base64ToString(args);
            const transactionDetail = strToJson(result);
            if (!transactionDetail) continue;
            const {receiver_id: to, amount} = transactionDetail;

            hashDetail = {
              transactionDetail: {from, to, amount},
              tipsBalanceInfo: null,
              tokenId: receiver_id,
            };
            break;
          }

          // Pay Content
          case 'pay': {
            // TODO: When contract is ready
            break;
          }

          // SendTip With NEAR to KNOWN RECEIVER
          // Example: F7JgBje3dAxipcHwP3jyCMKZkjBGMaLXxqjyPD7AKovn
          default: {
            const {deposit: amount} = action[key];

            return {
              transactionDetail: {from, to: receiver_id, amount},
              tipsBalanceInfo: null,
              tokenId: null,
            };
          }
        }
      }

      if (hashDetail) break;
    }

    if (!hashDetail) {
      throw new HttpErrors.UnprocessableEntity('RecordNotFound');
    }

    return hashDetail;
  }

  // ------------------------------------------------

  private async connect(
    rpcURL: string,
    types?: AnyObject,
  ): Promise<ApiPromise> {
    try {
      return await polkadotApi(rpcURL, types);
    } catch {
      throw new HttpErrors.UnprocessableEntity('Unable to connect');
    }
  }

  private async getQueueNumber(nonce: number, type: string): Promise<number> {
    const queue = await this.queueRepository.get(type);

    let priority = nonce;

    if (queue?.priority >= priority) priority = queue.priority;
    else priority = nonce;

    await this.queueRepository.set(type, {priority: priority + 1});
    await this.queueRepository.expire(type, 60 * 60 * 1000);

    return priority;
  }

  private parseBN(
    number: string | number,
    base?: number | 'hex' | undefined,
  ): BN {
    try {
      return new BN(number, base);
    } catch {
      //
    }

    return new BN(0);
  }
}

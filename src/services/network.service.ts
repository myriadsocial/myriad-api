import {BindingScope, inject, injectable} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {ClaimReference, Currency, Network} from '../models';
import {
  CurrencyRepository,
  NetworkRepository,
  QueueRepository,
  ServerRepository,
  UserSocialMediaRepository,
  WalletRepository,
} from '../repositories';
import {PolkadotJs} from '../utils/polkadotJs-utils';
import {CoinMarketCap} from './coin-market-cap.service';
import {providers, transactions, utils} from 'near-api-js';
import {HttpErrors} from '@loopback/rest';
import {ApiPromise} from '@polkadot/api';
import {config} from '../config';
import {DateUtils} from '../utils/date-utils';
import {AuthenticationBindings} from '@loopback/authentication';
import {UserProfile, securityId} from '@loopback/security';
import {BN} from '@polkadot/util';
import {sha256} from 'js-sha256';
import {Transaction} from '../interfaces';

const nearSeedPhrase = require('near-seed-phrase');
const {polkadotApi, getKeyring} = new PolkadotJs();
const dateUtils = new DateUtils();

interface ClaimReferenceData {
  rpcURL: string;
  serverId: string;
  accountId: string;
  txFee: string;
  referenceIds: string[];
  contractId?: string;
}

/* eslint-disable   @typescript-eslint/naming-convention */
@injectable({scope: BindingScope.TRANSIENT})
export class NetworkService {
  constructor(
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
    @repository(NetworkRepository)
    protected networkRepository: NetworkRepository,
    @repository(QueueRepository)
    protected queueRepository: QueueRepository,
    @repository(ServerRepository)
    protected serverRepository: ServerRepository,
    @repository(UserSocialMediaRepository)
    protected userSocialMediaRepository: UserSocialMediaRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
    @inject('services.CoinMarketCap')
    protected coinMarketCapService: CoinMarketCap,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    protected currentUser: UserProfile,
  ) {}

  async verifyPolkadotConnection(network: Network): Promise<Network | void> {
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

  async verifyNearContractAddress(
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

  async verifyContractAddress(
    networkId: string,
    rpcURL: string,
    contractId: string,
  ): Promise<Currency> {
    switch (networkId) {
      case 'near':
        return this.verifyNearContractAddress(networkId, rpcURL, contractId);

      default:
        throw new HttpErrors.UnprocessableEntity(
          `Contract address ${contractId} not found in network ${networkId}`,
        );
    }
  }

  async claimReference(claimReference: ClaimReference): Promise<Transaction> {
    const userId = this.currentUser?.[securityId];
    const txFee = claimReference.txFee;
    const contractId = claimReference.tippingContractId;

    if (!userId) {
      throw new HttpErrors.Forbidden('UnathorizedUser');
    }

    if (parseInt(txFee) === 0) {
      throw new HttpErrors.UnprocessableEntity('TxFeeMustLargerThanZero');
    }

    const wallet = await this.walletRepository.findOne({
      where: {
        userId: this.currentUser[securityId],
        primary: true,
      },
      include: ['network'],
    });

    if (!wallet?.network) throw new HttpErrors.NotFound('WalletNotFound');

    const [server, socialMedia] = await Promise.all([
      this.serverRepository.findById(config.MYRIAD_SERVER_ID),
      this.userSocialMediaRepository.find({where: {userId}}),
    ]);

    const accountId = wallet.id;
    const networkId = wallet.networkId;
    const referenceIds = socialMedia.map(e => e.peopleId);
    const claimReferenceData = {
      rpcURL: wallet.network.rpcURL,
      serverId: server.id,
      accountId,
      txFee,
      referenceIds,
      contractId,
    };

    switch (networkId) {
      case 'near': {
        const serverId = server?.accountId?.[networkId];

        if (!serverId) {
          throw new HttpErrors.UnprocessableEntity('ServerNotExists');
        }

        return this.claimReferenceNear({...claimReferenceData, serverId});
      }

      case 'myriad':
        return this.claimReferenceMyriad(claimReferenceData);

      default:
        throw new HttpErrors.NotFound('WalletNotFound');
    }
  }

  async claimReferenceNear(
    claimReferenceData: ClaimReferenceData,
  ): Promise<Transaction> {
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

      const mnemonic = config.MYRIAD_ADMIN_MNEMONIC;
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

  async claimReferenceMyriad(
    claimReferenceData: ClaimReferenceData,
  ): Promise<Transaction> {
    let api: ApiPromise | null = null;

    try {
      const {serverId, accountId, rpcURL, txFee, referenceIds} =
        claimReferenceData;

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
        throw new HttpErrors.UnprocessableEntity('TxFeeInsufficient');
      }

      const tipsBalance = JSON.parse(rawTipsBalance.toString());
      const balance = parseInt(tipsBalance.amount).toString();
      const mnemonic = config.MYRIAD_ADMIN_MNEMONIC;
      const serverAdmin = getKeyring().addFromMnemonic(mnemonic);
      const currencies = await this.currencyRepository.find(<AnyObject>{
        where: {
          networkId: 'myriad',
          referenceId: {
            $neq: null,
          },
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
      const notSufficientBalance = new BN(balance).lt(new BN(txFee));
      const notSufficientFee = new BN(txFee).lt(estimateTxFee);

      if (notSufficientBalance || notSufficientFee) {
        throw new HttpErrors.UnprocessableEntity('TxFeeInsufficient');
      }

      const {nonce: currentNonce} = await api.query.system.account(
        serverAddress,
      );

      const nonce = await this.getQueueNumber(
        currentNonce.toJSON(),
        config.MYRIAD_SERVER_ID,
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
    } catch {
      throw new HttpErrors.UnprocessableEntity('FailedToVerify');
    } finally {
      if (api) await api.disconnect();
    }
  }

  async connect(rpcURL: string, types?: AnyObject): Promise<ApiPromise> {
    try {
      return await polkadotApi(rpcURL, types);
    } catch {
      throw new HttpErrors.UnprocessableEntity('Unable to connect');
    }
  }

  async getQueueNumber(nonce: number, type: string): Promise<number> {
    const queue = await this.queueRepository.get(type);

    let priority = nonce;

    if (queue?.priority >= priority) priority = queue.priority;
    else priority = nonce;

    await this.queueRepository.set(type, {priority: priority + 1});
    await this.queueRepository.expire(type, 1 * dateUtils.hour);

    return priority;
  }
}

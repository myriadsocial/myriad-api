import {BindingScope, inject, injectable} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {Currency, Network} from '../models';
import {
  CurrencyRepository,
  NetworkRepository,
  QueueRepository,
  WalletRepository,
} from '../repositories';
import {PolkadotJs} from '../utils/polkadotJs-utils';
import {CoinMarketCap} from './coin-market-cap.service';
import {providers} from 'near-api-js';
import {ReferenceType, WalletType} from '../enums';
import {HttpErrors} from '@loopback/rest';
import {ApiPromise} from '@polkadot/api';
import {config} from '../config';
import {DateUtils} from '../utils/date-utils';

const {polkadotApi, getKeyring} = new PolkadotJs();
const dateUtils = new DateUtils();

/* eslint-disable   @typescript-eslint/naming-convention */
@injectable({scope: BindingScope.TRANSIENT})
export class NetworkService {
  constructor(
    @repository(NetworkRepository)
    protected networkRepository: NetworkRepository,
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
    @repository(QueueRepository)
    protected queueRepository: QueueRepository,
    @repository(WalletRepository)
    protected walletRepository: WalletRepository,
    @inject('services.CoinMarketCap')
    protected coinMarketCapService: CoinMarketCap,
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

  async connectSocialMedia(
    userId: string,
    peopleId: string,
    ftIdentifier = 'native',
  ): Promise<AnyObject | void> {
    if (!config.MYRIAD_SERVER_ID) return;
    const tipsBalanceInfo = {
      serverId: config.MYRIAD_SERVER_ID,
      referenceType: ReferenceType.PEOPLE,
      referenceId: peopleId.toString(),
      ftIdentifier: ftIdentifier,
    };

    const wallets = await this.walletRepository.find({
      where: {userId},
    });
    const polkadotWallet = wallets.find(
      wallet => wallet.type === WalletType.POLKADOT,
    );

    return Promise.allSettled([
      this.claimReferencePolkadot(
        tipsBalanceInfo,
        userId,
        polkadotWallet?.id ?? null,
      ),
    ]);
  }

  async connectAccount(
    type: string,
    userId: string,
    accountId: string,
    ftIdentifier = 'native',
  ): Promise<void> {
    if (!config.MYRIAD_SERVER_ID) return;
    const tipsBalanceInfo = {
      serverId: config.MYRIAD_SERVER_ID,
      referenceType: ReferenceType.USER,
      referenceId: userId.toString(),
      ftIdentifier: ftIdentifier,
    };

    switch (type) {
      case WalletType.POLKADOT:
        return this.claimReferencePolkadot(tipsBalanceInfo, userId, accountId);

      case WalletType.NEAR:
      default:
        throw new HttpErrors.UnprocessableEntity('Wallet not exist');
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

  async claimReferencePolkadot(
    tipsBalanceInfo: AnyObject,
    userId: string,
    accountId: string | null,
  ) {
    try {
      const {rpcURL} = await this.networkRepository.findById('myriad');
      const api = await this.connect(rpcURL);
      const mnemonic = config.MYRIAD_ADMIN_MNEMONIC;
      const serverAdmin = getKeyring().addFromMnemonic(mnemonic);
      const extrinsic = api.tx.tipping.claimReference(
        tipsBalanceInfo,
        ReferenceType.USER,
        userId.toString(),
        accountId,
      );

      const {nonce: currentNonce} = await api.query.system.account(
        serverAdmin.address,
      );
      const nonce = await this.getQueueNumber(
        currentNonce.toJSON(),
        config.MYRIAD_SERVER_ID,
      );

      await extrinsic.signAndSend(serverAdmin, {nonce});
      await api.disconnect();
    } catch {
      // ignore
    }
  }

  async connect(rpcURL: string, types?: AnyObject): Promise<ApiPromise> {
    try {
      return await polkadotApi(rpcURL, types);
    } catch {
      throw new HttpErrors.UnprocessableEntity('Unable to connect');
    }
  }
}

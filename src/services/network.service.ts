import {BindingScope, inject, injectable} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {Currency, Network} from '../models';
import {
  CurrencyRepository,
  ExchangeRateRepository,
  NetworkRepository,
  UserSocialMediaRepository,
} from '../repositories';
import {PolkadotJs} from '../utils/polkadotJs-utils';
import {CoinMarketCap} from './coin-market-cap.service';
import {providers} from 'near-api-js';
import {NetworkType} from '../enums';
import {HttpErrors} from '@loopback/rest';
import {ApiPromise} from '@polkadot/api';
import {BcryptHasher} from './authentication/hash.password.service';
import {config} from '../config';
import {TokenServiceBindings} from '../keys';
import {JWTService} from './authentication';
import {formatedBalance, parseJSON} from '../utils/formated-balance';

/* eslint-disable   @typescript-eslint/naming-convention */
@injectable({scope: BindingScope.TRANSIENT})
export class NetworkService {
  constructor(
    @repository(NetworkRepository)
    public networkRepository: NetworkRepository,
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
    @repository(ExchangeRateRepository)
    protected exchangeRateRepository: ExchangeRateRepository,
    @repository(UserSocialMediaRepository)
    protected userSocialMediaRepository: UserSocialMediaRepository,
    @inject('services.CoinMarketCap')
    protected coinMarketCapService: CoinMarketCap,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    protected jwtService: JWTService,
  ) {}

  async verifyPolkadotConnection(network: Network): Promise<Network | void> {
    const {types, rpcURL} = network;
    const {getSystemParameters} = new PolkadotJs();
    const typesBundle = parseJSON(types);
    const api = await this.connect(rpcURL, typesBundle);
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
      types: typesBundle,
    });
  }

  async nearAccountBalance(
    accountId: string,
    network: Network,
    currencies: Currency[],
  ): Promise<AnyObject[]> {
    if (!accountId.endsWith('.near')) {
      return currencies.map(currency => {
        return {
          ...currency,
          balance: '0',
          formattedBalance: '0',
          priceInUSD: '0',
          address: accountId,
        };
      });
    }

    const {rpcURL} = network;
    const provider = new providers.JsonRpcProvider({url: rpcURL});

    return Promise.all(
      currencies.map(async currency => {
        let balance = '0';
        let formattedBalance = '0';
        let priceInUSD = '0';

        const {native, referenceId, decimal, symbol} = currency;
        const exchangeRate = await this.exchangeRateRepository.get(symbol);

        if (exchangeRate) priceInUSD = exchangeRate.price.toString();

        try {
          if (native) {
            const nearAccount: AnyObject = await provider.query({
              request_type: 'view_account',
              account_id: accountId,
              finality: 'final',
            });

            balance = nearAccount.amount;
            formattedBalance = formatedBalance(balance, decimal);
          } else {
            const data = JSON.stringify({account_id: accountId});
            const buff = Buffer.from(data);
            const base64data = buff.toString('base64');
            const result: AnyObject = await provider.query({
              request_type: 'call_function',
              account_id: referenceId,
              method_name: 'ft_balance_of',
              args_base64: base64data,
              finality: 'final',
            });

            balance = JSON.parse(Buffer.from(result.result).toString());
            formattedBalance = formatedBalance(balance, decimal);
          }
        } catch {
          // ignore
        }

        return {...currency, balance, formattedBalance, priceInUSD, accountId};
      }),
    );
  }

  async polkadotAccountBalance(
    accountId: string,
    network: Network,
    currencies: Currency[],
  ): Promise<AnyObject[]> {
    if (!accountId.startsWith('0x') && accountId.length !== 66) {
      return currencies.map(currency => {
        return {
          ...currency,
          balance: '0',
          formattedBalance: '0',
          priceInUSD: '0',
          address: accountId,
        };
      });
    }

    const {rpcURL, types} = network;
    const typesBundle = parseJSON(types);
    const api = await this.connect(rpcURL, typesBundle);

    const result = await Promise.all(
      currencies.map(async currency => {
        let balance = '0';
        let formattedBalance = '0';
        let priceInUSD = '0';

        const {native, symbol, decimal} = currency;
        const exchangeRate = await this.exchangeRateRepository.get(symbol);

        if (exchangeRate) priceInUSD = exchangeRate.price.toString();

        try {
          if (native) {
            const nativeBalance = await api.query.system.account(accountId);
            balance = nativeBalance.data.free.toString();
            formattedBalance = formatedBalance(balance, decimal);
          } else {
            const nonNativeBalance: AnyObject = await api.query.tokens.accounts(
              accountId,
              {Token: symbol},
            );

            balance = nonNativeBalance.toJSON().free.toString();
            formattedBalance = formatedBalance(balance, decimal);
          }
        } catch {
          // ignore
        }

        return {
          ...currency,
          balance,
          formattedBalance,
          priceInUSD,
          address: accountId,
        };
      }),
    );

    await api.disconnect();

    return result;
  }

  async nearEscrowBalance(
    userId: string,
    networkId: string,
  ): Promise<AnyObject[]> {
    const network = await this.networkRepository.findById(networkId, {
      include: ['currencies'],
    });

    return Promise.all(
      (network?.currencies ?? []).map(async currency => {
        let priceInUSD = '0';

        const exchangeRate = await this.exchangeRateRepository.get(
          currency.symbol,
        );

        if (exchangeRate) priceInUSD = exchangeRate.price.toString();

        return {
          ...currency,
          balance: '0',
          priceInUSD: priceInUSD,
        };
      }),
    );
  }

  async polkadotEscrowBalance(
    userId: string,
    networkId: string,
  ): Promise<AnyObject[]> {
    const network = await this.networkRepository.findById(networkId, {
      include: ['currencies'],
    });

    if (network.currencies.length === 0) return [];
    if (network.id !== 'myriad') {
      return Promise.all(
        (network?.currencies ?? []).map(async currency => {
          let priceInUSD = '0';

          const exchangeRate = await this.exchangeRateRepository.get(
            currency.symbol,
          );

          if (exchangeRate) priceInUSD = exchangeRate.price.toString();

          return {
            ...currency,
            balance: '0',
            priceInUSD: priceInUSD,
          };
        }),
      );
    }
    const {rpcURL, types} = network;
    const {getKeyring} = new PolkadotJs();
    const typesBundle = parseJSON(types);
    const api = await this.connect(rpcURL, typesBundle);
    const currencies = network.currencies;
    const hasher = new BcryptHasher();

    return Promise.all(
      currencies.map(async (currency, index) => {
        const {native, decimal, symbol} = currency;
        const userSocialMedias = await this.userSocialMediaRepository.find({
          where: {userId: userId},
          include: ['people'],
        });
        const people = userSocialMedias.map(e => e.people);

        let totalBalance = 0;
        let priceInUSD = '0';

        for (const person of people) {
          if (!person) continue;

          const {
            id: peopleId,
            originUserId,
            platform,
            createdAt,
            walletAddressPassword: storedPassword,
          } = person;

          if (!storedPassword) continue;
          const password = peopleId + config.MYRIAD_ESCROW_SECRET_KEY;
          const match = await hasher.comparePassword(password, storedPassword);
          if (!match) continue;
          const token = await this.jwtService.generateAnyToken({
            id: peopleId,
            originUserId: originUserId,
            platform: platform,
            iat: new Date(createdAt ?? '').getTime(),
          });
          const address = getKeyring().addFromUri('//' + token);

          if (native) {
            const nativeBalance = await api.query.system.account(
              address.address,
            );
            totalBalance += nativeBalance.data.free.toJSON();
          } else {
            const nonNativeBalance: AnyObject = await api.query.tokens.accounts(
              address.publicKey,
              {Token: symbol},
            );
            totalBalance += nonNativeBalance.toJSON().free;
          }
        }

        const exchangeRate = await this.exchangeRateRepository.get(symbol);

        if (exchangeRate) priceInUSD = exchangeRate.price.toString();
        if (index === currencies.length - 1) await api.disconnect();

        const balance = totalBalance.toString();

        return {
          ...currency,
          priceInUSD,
          balance: balance,
          formattedBalance: formatedBalance(balance, decimal),
        };
      }),
    );
  }

  async escrowBalance(userId: string, networkId: string): Promise<AnyObject[]> {
    switch (networkId) {
      case 'myriad':
      case 'polkadot':
      case 'kusama':
        return this.polkadotEscrowBalance(userId, networkId);

      default:
        return this.nearEscrowBalance(userId, networkId);
    }
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
      case NetworkType.NEAR:
        return this.verifyNearContractAddress(networkId, rpcURL, contractId);

      default:
        throw new HttpErrors.UnprocessableEntity(
          `Contract address ${contractId} not found in network ${networkId}`,
        );
    }
  }

  async connect(rpcURL: string, types?: AnyObject): Promise<ApiPromise> {
    const {polkadotApi} = new PolkadotJs();

    try {
      return await polkadotApi(rpcURL, types);
    } catch {
      throw new HttpErrors.UnprocessableEntity('Unable to connect');
    }
  }
}

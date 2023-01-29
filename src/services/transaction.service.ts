import {BindingScope, injectable, service} from '@loopback/core';
import {AnyObject, Filter, repository, Where} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {decodeAddress} from '@polkadot/util-crypto';
import {ActivityLogType, ReferenceType} from '../enums';
import {
  Currency,
  CurrencyWithAmount,
  Transaction,
  TransactionWithRelations,
  UpdateTransactionDto,
  Wallet,
  WalletWithRelations,
} from '../models';
import {
  ContentPriceRepository,
  CurrencyRepository,
  PeopleRepository,
  TransactionRepository,
  UserRepository,
  UserSocialMediaRepository,
  WalletRepository,
} from '../repositories';
import {ActivityLogService} from './activity-log.service';
import {MetricService} from './metric.service';
import {NetworkService} from './network.service';
import {NotificationService} from './notification.service';
import {u8aToHex} from '@polkadot/util';
import {isHex} from '@polkadot/util';

export interface TotalTips {
  data: CurrencyWithAmount[];
  additionalData?: AnyObject;
}

export interface AdditionalData {
  toWalletId?: boolean;
  contentReferenceId?: string;
}

@injectable({scope: BindingScope.TRANSIENT})
export class TransactionService {
  constructor(
    @repository(ContentPriceRepository)
    private contentPriceRepository: ContentPriceRepository,
    @repository(CurrencyRepository)
    private currencyRepository: CurrencyRepository,
    @repository(PeopleRepository)
    private peopleRepository: PeopleRepository,
    @repository(TransactionRepository)
    private transactionRepository: TransactionRepository,
    @repository(UserRepository)
    private userRepository: UserRepository,
    @repository(UserSocialMediaRepository)
    private userSocialMediaRepository: UserSocialMediaRepository,
    @repository(WalletRepository)
    private walletRepository: WalletRepository,
    @service(ActivityLogService)
    private activityLogService: ActivityLogService,
    @service(MetricService)
    private metricService: MetricService,
    @service(NetworkService)
    private networkService: NetworkService,
    @service(NotificationService)
    private notificationService: NotificationService,
  ) {}

  public collection() {
    const collection =
      this.transactionRepository.dataSource.connector?.collection(
        Transaction.modelName,
      );

    if (!collection) {
      throw new HttpErrors.NotFound('CollectionNotFound');
    }

    return collection;
  }

  public async create(
    transaction: Omit<Transaction, 'id'>,
    currentUserId: string,
  ): Promise<Transaction> {
    const additional = await this.beforeCreate(transaction, currentUserId);

    return this.transactionRepository
      .create(transaction)
      .then(result => this.afterCreate(result, additional))
      .catch(err => {
        throw err;
      });
  }

  public async find(
    filter?: Filter<Transaction>,
  ): Promise<TransactionWithRelations[]> {
    return this.transactionRepository.find(filter);
  }

  public async patch(
    data: UpdateTransactionDto,
    currentUserId: string,
  ): Promise<void> {
    const {currencyIds} = data;
    const socialMedias = await this.userSocialMediaRepository.find({
      where: {userId: currentUserId},
    });

    const promises: Promise<AnyObject>[] = socialMedias.map(e => {
      return this.transactionRepository.updateAll(
        {to: currentUserId},
        {to: e.peopleId, currencyId: {inq: currencyIds}},
      );
    });

    await Promise.allSettled(promises);
  }

  public async totalTipsAmount(
    currentUserId: string,
    status: string,
    referenceType?: ReferenceType,
    networkType?: string,
    symbol?: string,
  ): Promise<TotalTips> {
    const where: Where<Transaction> = {};
    const additionalData: AnyObject = {currentUserId, status};

    if (referenceType) {
      Object.assign(where, {type: referenceType});
      Object.assign(additionalData, {referenceType});
    }

    if (status === 'received') {
      Object.assign(where, {to: currentUserId});
    }

    if (status === 'sent') {
      Object.assign(where, {from: currentUserId});
    }

    if (networkType) {
      const currencyWhere: Where<Currency> = {
        networkId: networkType,
      };

      Object.assign(additionalData, {networkType});

      if (symbol) {
        Object.assign(currencyWhere, {symbol});
        Object.assign(additionalData, {symbol});
      }

      const filter = {where: currencyWhere};
      const currencies = await this.currencyRepository.find(filter);
      const currencyIds = currencies.map(currency => currency.id);

      Object.assign(where, {currencyId: {$in: currencyIds}});
    }

    const result = await this.collection()
      .aggregate([
        {$match: where},
        {
          $group: {
            _id: '$currencyId',
            totalTips: {
              $sum: '$amount',
            },
          },
        },
      ])
      .get();

    if (!result.length) {
      return {
        data: [],
      };
    }

    const currencyWithAmount: CurrencyWithAmount[] = await Promise.all(
      result.map(async (e: AnyObject) => {
        return this.currencyRepository
          .findById(e._id)
          .then(currency => ({...currency, amount: e.totalTips}))
          .catch(() => null);
      }),
    );

    const data = [...currencyWithAmount].filter(e => e !== null);

    return {data, additionalData};
  }

  // ------------------------------------------------

  // ------ PrivateMethod ---------------------------

  private async beforeCreate(
    transaction: Omit<Transaction, 'id'>,
    currentUserId: string,
  ): Promise<AdditionalData> {
    const {from, to, type, referenceId} = transaction;

    if (from === to) {
      throw new HttpErrors.UnprocessableEntity(
        'From and to address cannot be the same!',
      );
    }

    if (
      type === ReferenceType.POST ||
      type === ReferenceType.COMMENT ||
      type === ReferenceType.UNLOCKABLECONTENT
    ) {
      if (!referenceId) {
        throw new HttpErrors.UnprocessableEntity('Please insert referenceId');
      }
    }

    // Post Id related to where the exclusive content located
    const [updateReferenceId, contentReferenceId] = (referenceId ?? '').split(
      '/',
    );

    if (transaction.type === ReferenceType.UNLOCKABLECONTENT) {
      transaction.referenceId = updateReferenceId;
      await this.validateHash(transaction);
    }

    let toWalletId = false;

    const toWallet = await this.walletRepository
      .findById(to, {include: ['user']})
      .catch(() => this.userRepository.findById(to))
      .catch(() => this.peopleRepository.findById(to))
      .then(result => {
        if (result.constructor.name === 'Wallet') {
          const wallet = new Wallet(result) as WalletWithRelations;

          toWalletId = true;

          if (!wallet?.user) throw new Error('UserNotFound');
          return wallet;
        }

        return null;
      })
      .catch(() => {
        throw new HttpErrors.NotFound('UserNotFound');
      });

    transaction.from = currentUserId;

    if (toWallet) {
      Object.assign(transaction, {to: toWallet.userId});
    }

    return {toWalletId, contentReferenceId};
  }

  private async afterCreate(
    transaction: Transaction,
    additional: AdditionalData,
  ): Promise<Transaction> {
    const {from, referenceId, type} = transaction;
    const activityType =
      type === ReferenceType.UNLOCKABLECONTENT
        ? ActivityLogType.PAIDCONTENT
        : ActivityLogType.SENDTIP;

    const jobs: Promise<AnyObject | void>[] = [
      this.notificationService.sendTipsSuccess(transaction, additional),
      this.metricService.userMetric(from),
      this.activityLogService.create(
        activityType,
        from,
        ReferenceType.TRANSACTION,
      ),
    ];

    if (type !== ReferenceType.UNLOCKABLECONTENT) {
      jobs.push(
        this.metricService.publicMetric(ReferenceType.POST, referenceId ?? ''),
      );
    }

    Promise.allSettled(jobs) as Promise<AnyObject>;

    return transaction;
  }

  private async validateHash(
    transaction: Omit<Transaction, 'id'>,
  ): Promise<void> {
    const exist = await this.transactionRepository.findOne({
      where: {hash: transaction.hash},
    });

    if (exist) {
      throw new HttpErrors.UnprocessableEntity('HashAlreadyExists');
    }

    const currency = await this.currencyRepository.findById(
      transaction.currencyId,
      {
        include: ['network'],
      },
    );

    let methodName;

    if (transaction.type === ReferenceType.UNLOCKABLECONTENT) {
      const price = await this.contentPriceRepository.findOne({
        where: {unlockableContentId: transaction.referenceId},
      });

      if (!price) {
        throw new HttpErrors.NotFound('ContentPriceNotFound');
      }

      if (transaction.amount < price.amount) {
        throw new HttpErrors.NotFound('InvalidPayment');
      }

      const hasPaid = await this.transactionRepository.findOne({
        where: {
          referenceId: transaction.referenceId,
          type: ReferenceType.UNLOCKABLECONTENT,
          from: transaction.from,
          to: transaction.to,
        },
      });

      if (hasPaid) {
        throw new HttpErrors.UnprocessableEntity('ContentAlreadyPaid');
      }

      methodName = 'PayUnlockableContent';
    }

    const blockchainPlatform = currency?.network?.blockchainPlatform;

    const info = await this.networkService.transactionHashInfo(
      transaction,
      currency,
      methodName,
    );

    if (!info) throw new HttpErrors.NotFound('TransactionNotFound');

    const {tipsBalanceInfo, tokenId, transactionDetail} = info;

    // Validate currency
    if (tokenId) {
      if (tokenId.toString() !== currency.referenceId) {
        throw new HttpErrors.UnprocessableEntity('InvalidCurrency');
      }

      if (currency.native) {
        throw new HttpErrors.UnprocessableEntity('InvalidCurrency');
      }
    } else {
      if (!currency.native) {
        throw new HttpErrors.UnprocessableEntity('InvalidCurrency');
      }
    }

    // Validate from address
    const from =
      blockchainPlatform === 'near'
        ? isHex(`0x${transactionDetail.from}`)
          ? `0x${transactionDetail.from}`
          : transaction.from
        : u8aToHex(decodeAddress(transactionDetail.from));

    if (transaction.from !== from) {
      throw new HttpErrors.UnprocessableEntity('InvalidSender');
    }

    // Validate balance
    const decimal = 10 ** currency.decimal;
    const parseAmount = parseInt(transactionDetail.amount) / decimal;
    if (transaction.amount < parseAmount) {
      throw new HttpErrors.UnprocessableEntity('InvalidAmount');
    }

    // Validate to address
    // For UnlockableContent/Tipping directly to user
    if (!tipsBalanceInfo) {
      const to =
        blockchainPlatform === 'near'
          ? isHex(`0x${transactionDetail.to}`)
            ? `0x${transactionDetail.to}`
            : transaction.to
          : u8aToHex(decodeAddress(transactionDetail.to));

      if (transaction.to !== to) {
        throw new HttpErrors.UnprocessableEntity('InvalidReceiver');
      }
    }

    // Validate referenceId and referenceType
    // For unlockable content
    if (transaction.type === ReferenceType.UNLOCKABLECONTENT) {
      if (tipsBalanceInfo) {
        const {referenceType, referenceId} = tipsBalanceInfo;
        if (referenceType !== transaction.type) {
          throw new HttpErrors.UnprocessableEntity('InvalidReference');
        }

        if (referenceId !== transaction.referenceId) {
          throw new HttpErrors.UnprocessableEntity('InvalidReference');
        }
      }
    }
  }

  // ------------------------------------------------
}

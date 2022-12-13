import {AuthenticationBindings} from '@loopback/authentication';
import {BindingScope, inject, injectable, service} from '@loopback/core';
import {AnyObject, Filter, repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {decodeAddress} from '@polkadot/util-crypto';
import {ActivityLogType, ReferenceType} from '../enums';
import {
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
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private currentUser: UserProfile,
  ) {}

  public async create(
    transaction: Omit<Transaction, 'id'>,
  ): Promise<Transaction> {
    const isToWallet = await this.beforeCreate(transaction);

    return this.transactionRepository
      .create(transaction)
      .then(result => this.afterCreate(result, isToWallet))
      .catch(err => {
        throw err;
      });
  }

  public async find(
    filter?: Filter<Transaction>,
  ): Promise<TransactionWithRelations[]> {
    return this.transactionRepository.find(filter);
  }

  public async patch(data: UpdateTransactionDto): Promise<void> {
    const userId = this.currentUser[securityId];
    const {currencyIds} = data;
    const socialMedias = await this.userSocialMediaRepository.find({
      where: {userId},
    });

    const promises: Promise<AnyObject>[] = socialMedias.map(e => {
      return this.transactionRepository.updateAll(
        {to: userId},
        {to: e.peopleId, currencyId: {inq: currencyIds}},
      );
    });

    await Promise.allSettled(promises);
  }

  // ------------------------------------------------

  // ------ PrivateMethod ---------------------------

  private async beforeCreate(
    transaction: Omit<Transaction, 'id'>,
  ): Promise<boolean> {
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

    await this.validateHash(transaction);

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

    transaction.from = this.currentUser[securityId];

    if (toWallet) {
      Object.assign(transaction, {to: toWallet.userId});
    }

    return toWalletId;
  }

  private async afterCreate(
    transaction: Transaction,
    isToWallet: boolean,
  ): Promise<Transaction> {
    const {from, referenceId, type} = transaction;
    const activityType =
      type === ReferenceType.UNLOCKABLECONTENT
        ? ActivityLogType.PAIDCONTENT
        : ActivityLogType.SENDTIP;

    const jobs: Promise<AnyObject | void>[] = [
      this.notificationService.sendTipsSuccess(transaction, isToWallet),
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

    if (blockchainPlatform === 'near') {
      if (transaction.type !== ReferenceType.UNLOCKABLECONTENT) return;
    }

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
    if (
      !tipsBalanceInfo ||
      transaction.type === ReferenceType.UNLOCKABLECONTENT
    ) {
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
    if (
      tipsBalanceInfo &&
      transaction.type === ReferenceType.UNLOCKABLECONTENT
    ) {
      const {referenceType, referenceId} = tipsBalanceInfo;
      if (referenceType !== transaction.type) {
        throw new HttpErrors.UnprocessableEntity('InvalidReference');
      }

      if (referenceId !== transaction.referenceId) {
        throw new HttpErrors.UnprocessableEntity('InvalidReference');
      }
    }
  }

  // ------------------------------------------------
}

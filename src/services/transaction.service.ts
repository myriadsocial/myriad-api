import {AuthenticationBindings} from '@loopback/authentication';
import {BindingScope, inject, injectable, service} from '@loopback/core';
import {AnyObject, Filter, repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {ActivityLogType, ReferenceType} from '../enums';
import {
  Transaction,
  TransactionWithRelations,
  UpdateTransactionDto,
  Wallet,
  WalletWithRelations,
} from '../models';
import {
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

@injectable({scope: BindingScope.TRANSIENT})
export class TransactionService {
  constructor(
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
    contractId?: string,
  ): Promise<Transaction> {
    const isToWallet = await this.beforeCreate(transaction, contractId);

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
    contractId?: string,
  ): Promise<boolean> {
    const {from, to, type, currencyId, referenceId} = transaction;

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

    await Promise.all([
      this.validateHash(transaction, contractId),
      this.currencyRepository.findById(currencyId),
    ]);

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
    contractId?: string,
  ): Promise<void> {
    // TODO: Validate blockchain hash
    if (transaction.type === ReferenceType.UNLOCKABLECONTENT) {
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

      const isPaid = await this.networkService.verifyUnlockableContentPayment(
        transaction,
        contractId,
      );

      if (!isPaid) {
        throw new HttpErrors.UnprocessableEntity('ContentNotPaid');
      }

      return;
    }

    // Validate tipping hash
  }

  // ------------------------------------------------
}

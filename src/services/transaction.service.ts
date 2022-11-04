import {AuthenticationBindings} from '@loopback/authentication';
import {BindingScope, inject, injectable, service} from '@loopback/core';
import {AnyObject, Filter, repository, Where} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {ActivityLogType, ReferenceType} from '../enums';
import {
  Transaction,
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

  public async find(filter?: Filter<Transaction>) {
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

  // ------ TransactionWhereBuilder -----------------

  public detail(where: Where<Transaction>, data: AnyObject) {
    const {referenceId, currencyId, referenceType, status} = data;
    const profile = referenceType === ReferenceType.USER && referenceId;

    switch (referenceType) {
      case ReferenceType.POST:
      case ReferenceType.COMMENT: {
        if (!referenceId) {
          throw new HttpErrors.UnprocessableEntity('Please input reference id');
        }
        where = {referenceId, type: referenceType};
        break;
      }

      default: {
        let userId;
        if (profile) {
          Object.assign(where, {
            type: {
              nin: [ReferenceType.POST],
            },
          });
          userId = referenceId ? referenceId.toString() : undefined;
        }

        if (status === 'received' || profile) {
          Object.assign(where, {
            to: userId ?? this.currentUser[securityId],
          });
        } else if (status === 'sent') {
          Object.assign(where, {
            from: userId ?? this.currentUser[securityId],
          });
        } else {
          Object.assign(where, {
            or: [
              {from: userId ?? this.currentUser[securityId]},
              {to: userId ?? this.currentUser[securityId]},
            ],
          });
        }
      }
    }

    if (currencyId) {
      Object.assign(where, {currencyId});
    }
  }

  // ------------------------------------------------

  // ------ PrivateMethod ---------------------------

  private async beforeCreate(
    transaction: Omit<Transaction, 'id'>,
  ): Promise<boolean> {
    const {from, to, type, currencyId, referenceId} = transaction;

    if (from === to) {
      throw new HttpErrors.UnprocessableEntity(
        'From and to address cannot be the same!',
      );
    }

    if (type === ReferenceType.POST || type === ReferenceType.COMMENT) {
      if (!referenceId) {
        throw new HttpErrors.UnprocessableEntity('Please insert referenceId');
      }
    }

    await this.currencyRepository.findById(currencyId);

    let toWalletId = false;

    await this.currencyRepository.findById(currencyId);
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
    const {from, referenceId} = transaction;

    Promise.allSettled([
      this.notificationService.sendTipsSuccess(transaction, isToWallet),
      this.metricService.userMetric(from),
      this.metricService.publicMetric(ReferenceType.POST, referenceId ?? ''),
      this.activityLogService.create(
        ActivityLogType.SENDTIP,
        from,
        ReferenceType.TRANSACTION,
      ),
    ]) as Promise<AnyObject>;

    return transaction;
  }

  // ------------------------------------------------
}

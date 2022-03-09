import {Getter, inject} from '@loopback/core';
import {
  BelongsToAccessor,
  DefaultCrudRepository,
  repository,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Currency, Transaction, TransactionRelations, Wallet} from '../models';
import {CurrencyRepository} from './currency.repository';
import {WalletRepository} from './wallet.repository';

export class TransactionRepository extends DefaultCrudRepository<
  Transaction,
  typeof Transaction.prototype.id,
  TransactionRelations
> {
  public readonly fromWallet: BelongsToAccessor<
    Wallet,
    typeof Transaction.prototype.id
  >;

  public readonly toWallet: BelongsToAccessor<
    Wallet,
    typeof Transaction.prototype.id
  >;

  public readonly currency: BelongsToAccessor<
    Currency,
    typeof Transaction.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('WalletRepository')
    protected walletRepositoryGetter: Getter<WalletRepository>,
    @repository.getter('CurrencyRepository')
    protected currencyRepositoryGetter: Getter<CurrencyRepository>,
  ) {
    super(Transaction, dataSource);
    this.fromWallet = this.createBelongsToAccessorFor(
      'fromWallet',
      walletRepositoryGetter,
    );
    this.registerInclusionResolver(
      'fromWallet',
      this.fromWallet.inclusionResolver,
    );
    this.toWallet = this.createBelongsToAccessorFor(
      'toWallet',
      walletRepositoryGetter,
    );
    this.registerInclusionResolver('toWallet', this.toWallet.inclusionResolver);
    this.currency = this.createBelongsToAccessorFor(
      'currency',
      currencyRepositoryGetter,
    );
    this.registerInclusionResolver('currency', this.currency.inclusionResolver);
  }
}

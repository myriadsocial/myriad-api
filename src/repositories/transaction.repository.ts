import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, DefaultCrudRepository, repository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Transaction, TransactionRelations, User} from '../models';
import {UserRepository} from './user.repository';

export class TransactionRepository extends DefaultCrudRepository<
  Transaction,
  typeof Transaction.prototype.id,
  TransactionRelations
> {

  public readonly fromUser: BelongsToAccessor<User, typeof Transaction.prototype.id>;

  public readonly toUser: BelongsToAccessor<User, typeof Transaction.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(Transaction, dataSource);
    this.fromUser = this.createBelongsToAccessorFor('fromUser', userRepositoryGetter,);
    this.registerInclusionResolver('fromUser', this.fromUser.inclusionResolver);
    this.toUser = this.createBelongsToAccessorFor('toUser', userRepositoryGetter,);
    this.registerInclusionResolver('toUser', this.toUser.inclusionResolver);
  }
}

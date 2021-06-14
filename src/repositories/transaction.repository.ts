import {Getter, inject} from '@loopback/core';
import {
  BelongsToAccessor,
  DefaultCrudRepository,
  repository
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Token, Transaction, TransactionRelations, User} from '../models';
import {TokenRepository} from './token.repository';
import {UserRepository} from './user.repository';

export class TransactionRepository extends DefaultCrudRepository<
  Transaction,
  typeof Transaction.prototype.id,
  TransactionRelations
> {

  public readonly fromUser: BelongsToAccessor<User, typeof Transaction.prototype.id>;

  public readonly toUser: BelongsToAccessor<User, typeof Transaction.prototype.id>;

  public readonly token: BelongsToAccessor<Token, typeof Transaction.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('TokenRepository')
    protected tokenRepositoryGetter: Getter<TokenRepository>,
  ) {
    super(Transaction, dataSource);
    this.token = this.createBelongsToAccessorFor('token', tokenRepositoryGetter,);
    this.registerInclusionResolver('token', this.token.inclusionResolver);
    this.fromUser = this.createBelongsToAccessorFor('fromUser', userRepositoryGetter,);
    this.registerInclusionResolver('fromUser', this.fromUser.inclusionResolver);
    this.toUser = this.createBelongsToAccessorFor('toUser', userRepositoryGetter,);
    this.registerInclusionResolver('toUser', this.toUser.inclusionResolver);
  }
}

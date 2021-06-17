import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {DetailTransaction, DetailTransactionRelations, User, Token} from '../models';
import {UserRepository} from './user.repository';
import {TokenRepository} from './token.repository';

export class DetailTransactionRepository extends DefaultCrudRepository<
  DetailTransaction,
  typeof DetailTransaction.prototype.id,
  DetailTransactionRelations
> {

  public readonly user: BelongsToAccessor<User, typeof DetailTransaction.prototype.id>;

  public readonly token: BelongsToAccessor<Token, typeof DetailTransaction.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource, @repository.getter('UserRepository') protected userRepositoryGetter: Getter<UserRepository>, @repository.getter('TokenRepository') protected tokenRepositoryGetter: Getter<TokenRepository>,
  ) {
    super(DetailTransaction, dataSource);
    this.token = this.createBelongsToAccessorFor('token', tokenRepositoryGetter,);
    this.registerInclusionResolver('token', this.token.inclusionResolver);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter,);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}

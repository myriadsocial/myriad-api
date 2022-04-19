import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Wallet, WalletRelations, User, Network} from '../models';
import {UserRepository} from './user.repository';
import {NetworkRepository} from './network.repository';

export class WalletRepository extends DefaultCrudRepository<
  Wallet,
  typeof Wallet.prototype.id,
  WalletRelations
> {
  public readonly user: BelongsToAccessor<User, typeof Wallet.prototype.id>;

  public readonly network: BelongsToAccessor<
    Network,
    typeof Wallet.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('NetworkRepository')
    protected networkRepositoryGetter: Getter<NetworkRepository>,
  ) {
    super(Wallet, dataSource);
    this.network = this.createBelongsToAccessorFor(
      'network',
      networkRepositoryGetter,
    );
    this.registerInclusionResolver('network', this.network.inclusionResolver);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}

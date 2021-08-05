import {Getter, inject} from '@loopback/core';
import {
  DefaultCrudRepository,
  HasManyRepositoryFactory,
  HasManyThroughRepositoryFactory,
  repository,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Currency, Friend, User, UserCredential, UserCurrency, UserRelations} from '../models';
import {CurrencyRepository} from './currency.repository';
import {FriendRepository} from './friend.repository';
import {UserCredentialRepository} from './user-credential.repository';
import {UserCurrencyRepository} from './user-currency.repository';

export class UserRepository extends DefaultCrudRepository<
  User,
  typeof User.prototype.id,
  UserRelations
> {
  public readonly userCredentials: HasManyRepositoryFactory<
    UserCredential,
    typeof User.prototype.id
  >;

  public readonly friends: HasManyRepositoryFactory<Friend, typeof User.prototype.id>;

  public readonly currencies: HasManyThroughRepositoryFactory<
    Currency,
    typeof Currency.prototype.id,
    UserCurrency,
    typeof User.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserCredentialRepository')
    protected userCredentialRepositoryGetter: Getter<UserCredentialRepository>,
    @repository.getter('UserCurrencyRepository')
    protected userCurrencyRepositoryGetter: Getter<UserCurrencyRepository>,
    @repository.getter('CurrencyRepository')
    protected currencyRepositoryGetter: Getter<CurrencyRepository>,
    @repository.getter('FriendRepository')
    protected friendRepositoryGetter: Getter<FriendRepository>,
  ) {
    super(User, dataSource);
    this.userCredentials = this.createHasManyRepositoryFactoryFor(
      'userCredentials',
      userCredentialRepositoryGetter,
    );
    this.registerInclusionResolver('userCredentials', this.userCredentials.inclusionResolver);
    this.friends = this.createHasManyRepositoryFactoryFor('friends', friendRepositoryGetter);
    this.registerInclusionResolver('friends', this.friends.inclusionResolver);
    this.currencies = this.createHasManyThroughRepositoryFactoryFor(
      'currencies',
      currencyRepositoryGetter,
      userCurrencyRepositoryGetter,
    );
    this.registerInclusionResolver('currencies', this.currencies.inclusionResolver);
  }
}

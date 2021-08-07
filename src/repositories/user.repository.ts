import {Getter, inject} from '@loopback/core';
import {
  DefaultCrudRepository,
  HasManyRepositoryFactory,
  HasManyThroughRepositoryFactory,
  repository,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {
  Currency,
  Experience,
  Friend,
  User,
  UserCurrency,
  UserExperience,
  UserRelations,
} from '../models';
import {CurrencyRepository} from './currency.repository';
import {ExperienceRepository} from './experience.repository';
import {FriendRepository} from './friend.repository';
import {UserCurrencyRepository} from './user-currency.repository';
import {UserExperienceRepository} from './user-experience.repository';
import {UserSocialMediaRepository} from './user-social-media.repository';

export class UserRepository extends DefaultCrudRepository<
  User,
  typeof User.prototype.id,
  UserRelations
> {
  public readonly friends: HasManyRepositoryFactory<Friend, typeof User.prototype.id>;

  public readonly experiences: HasManyThroughRepositoryFactory<
    Experience,
    typeof Experience.prototype.id,
    UserExperience,
    typeof User.prototype.id
  >;

  public readonly currencies: HasManyThroughRepositoryFactory<
    Currency,
    typeof Currency.prototype.id,
    UserCurrency,
    typeof User.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserSocialMediaRepository')
    protected userSocialMediaRepositoryGetter: Getter<UserSocialMediaRepository>,
    @repository.getter('UserCurrencyRepository')
    protected userCurrencyRepositoryGetter: Getter<UserCurrencyRepository>,
    @repository.getter('CurrencyRepository')
    protected currencyRepositoryGetter: Getter<CurrencyRepository>,
    @repository.getter('FriendRepository')
    protected friendRepositoryGetter: Getter<FriendRepository>,
    @repository.getter('ExperienceRepository')
    protected experienceRepositoryGetter: Getter<ExperienceRepository>,
    @repository.getter('UserExperienceRepository')
    protected userExperienceRepositoryGetter: Getter<UserExperienceRepository>,
  ) {
    super(User, dataSource);
    this.friends = this.createHasManyRepositoryFactoryFor('friends', friendRepositoryGetter);
    this.registerInclusionResolver('friends', this.friends.inclusionResolver);
    this.experiences = this.createHasManyThroughRepositoryFactoryFor(
      'experiences',
      experienceRepositoryGetter,
      userExperienceRepositoryGetter,
    );
    this.registerInclusionResolver('experiences', this.experiences.inclusionResolver);
    this.currencies = this.createHasManyThroughRepositoryFactoryFor(
      'currencies',
      currencyRepositoryGetter,
      userCurrencyRepositoryGetter,
    );
    this.registerInclusionResolver('currencies', this.currencies.inclusionResolver);
  }
}

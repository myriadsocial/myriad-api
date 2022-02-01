import {Getter, inject, bind, BindingScope} from '@loopback/core';
import {
  DefaultCrudRepository,
  HasManyRepositoryFactory,
  HasManyThroughRepositoryFactory,
  repository,
  HasOneRepositoryFactory,
  BelongsToAccessor,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {
  ActivityLog,
  Currency,
  Experience,
  Friend,
  User,
  UserCurrency,
  UserExperience,
  UserRelations,
  AccountSetting,
  NotificationSetting,
  People,
  UserSocialMedia,
  LanguageSetting,
  Wallet,
} from '../models';
import {ActivityLogRepository} from './activity-log.repository';
import {CurrencyRepository} from './currency.repository';
import {ExperienceRepository} from './experience.repository';
import {FriendRepository} from './friend.repository';
import {UserCurrencyRepository} from './user-currency.repository';
import {UserExperienceRepository} from './user-experience.repository';
import {UserSocialMediaRepository} from './user-social-media.repository';
import {AccountSettingRepository} from './account-setting.repository';
import {NotificationSettingRepository} from './notification-setting.repository';
import {PeopleRepository} from './people.repository';
import {LanguageSettingRepository} from './language-setting.repository';
import {WalletRepository} from './wallet.repository';

@bind({scope: BindingScope.SINGLETON})
export class UserRepository extends DefaultCrudRepository<
  User,
  typeof User.prototype.id,
  UserRelations
> {
  public readonly friends: HasManyRepositoryFactory<
    Friend,
    typeof User.prototype.id
  >;

  public readonly activityLogs: HasManyRepositoryFactory<
    ActivityLog,
    typeof User.prototype.id
  >;

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

  public readonly accountSetting: HasOneRepositoryFactory<
    AccountSetting,
    typeof User.prototype.id
  >;

  public readonly notificationSetting: HasOneRepositoryFactory<
    NotificationSetting,
    typeof User.prototype.id
  >;

  public readonly people: HasManyThroughRepositoryFactory<
    People,
    typeof People.prototype.id,
    UserSocialMedia,
    typeof User.prototype.id
  >;

  public readonly currency: BelongsToAccessor<
    Currency,
    typeof User.prototype.id
  >;

  public readonly experience: BelongsToAccessor<
    Experience,
    typeof User.prototype.id
  >;

  public readonly languageSetting: HasOneRepositoryFactory<
    LanguageSetting,
    typeof User.prototype.id
  >;

  public readonly wallets: HasManyRepositoryFactory<
    Wallet,
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
    @repository.getter('ActivityLogRepository')
    protected activityLogRepositoryGetter: Getter<ActivityLogRepository>,
    @repository.getter('AccountSettingRepository')
    protected accountSettingRepositoryGetter: Getter<AccountSettingRepository>,
    @repository.getter('NotificationSettingRepository')
    protected notificationSettingRepositoryGetter: Getter<NotificationSettingRepository>,
    @repository.getter('PeopleRepository')
    protected peopleRepositoryGetter: Getter<PeopleRepository>,
    @repository.getter('LanguageSettingRepository')
    protected languageSettingRepositoryGetter: Getter<LanguageSettingRepository>,
    @repository.getter('WalletRepository')
    protected walletRepositoryGetter: Getter<WalletRepository>,
  ) {
    super(User, dataSource);
    this.languageSetting = this.createHasOneRepositoryFactoryFor(
      'languageSetting',
      languageSettingRepositoryGetter,
    );
    this.registerInclusionResolver(
      'languageSetting',
      this.languageSetting.inclusionResolver,
    );
    this.experience = this.createBelongsToAccessorFor(
      'experience',
      experienceRepositoryGetter,
    );
    this.registerInclusionResolver(
      'experience',
      this.experience.inclusionResolver,
    );
    this.currency = this.createBelongsToAccessorFor(
      'currency',
      currencyRepositoryGetter,
    );
    this.registerInclusionResolver('currency', this.currency.inclusionResolver);
    this.people = this.createHasManyThroughRepositoryFactoryFor(
      'people',
      peopleRepositoryGetter,
      userSocialMediaRepositoryGetter,
    );
    this.registerInclusionResolver('people', this.people.inclusionResolver);
    this.notificationSetting = this.createHasOneRepositoryFactoryFor(
      'notificationSetting',
      notificationSettingRepositoryGetter,
    );
    this.registerInclusionResolver(
      'notificationSetting',
      this.notificationSetting.inclusionResolver,
    );
    this.accountSetting = this.createHasOneRepositoryFactoryFor(
      'accountSetting',
      accountSettingRepositoryGetter,
    );
    this.registerInclusionResolver(
      'accountSetting',
      this.accountSetting.inclusionResolver,
    );
    this.friends = this.createHasManyRepositoryFactoryFor(
      'friends',
      friendRepositoryGetter,
    );
    this.registerInclusionResolver('friends', this.friends.inclusionResolver);
    this.activityLogs = this.createHasManyRepositoryFactoryFor(
      'activityLogs',
      activityLogRepositoryGetter,
    );
    this.registerInclusionResolver(
      'activityLogs',
      this.activityLogs.inclusionResolver,
    );
    this.experiences = this.createHasManyThroughRepositoryFactoryFor(
      'experiences',
      experienceRepositoryGetter,
      userExperienceRepositoryGetter,
    );
    this.registerInclusionResolver(
      'experiences',
      this.experiences.inclusionResolver,
    );
    this.currencies = this.createHasManyThroughRepositoryFactoryFor(
      'currencies',
      currencyRepositoryGetter,
      userCurrencyRepositoryGetter,
    );
    this.registerInclusionResolver(
      'currencies',
      this.currencies.inclusionResolver,
    );
    this.wallets = this.createHasManyRepositoryFactoryFor(
      'wallets',
      walletRepositoryGetter,
    );
    this.registerInclusionResolver('wallets', this.wallets.inclusionResolver);
  }
}

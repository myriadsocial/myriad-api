import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {LanguageSetting, LanguageSettingRelations, User} from '../models';
import {UserRepository} from './user.repository';

export class LanguageSettingRepository extends DefaultCrudRepository<
  LanguageSetting,
  typeof LanguageSetting.prototype.id,
  LanguageSettingRelations
> {
  public readonly user: BelongsToAccessor<
    User,
    typeof LanguageSetting.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(LanguageSetting, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}

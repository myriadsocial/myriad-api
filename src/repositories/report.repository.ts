import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
  HasManyThroughRepositoryFactory,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Report, ReportRelations, User, Post, ReportUser} from '../models';
import {UserRepository} from './user.repository';
import {PostRepository} from './post.repository';
import {ReportUserRepository} from './report-user.repository';

export class ReportRepository extends DefaultCrudRepository<
  Report,
  typeof Report.prototype.id,
  ReportRelations
> {
  public readonly post: BelongsToAccessor<Post, typeof Report.prototype.id>;

  public readonly user: BelongsToAccessor<User, typeof Report.prototype.id>;

  public readonly reporters: HasManyThroughRepositoryFactory<
    User,
    typeof User.prototype.id,
    ReportUser,
    typeof Report.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('PostRepository')
    protected postRepositoryGetter: Getter<PostRepository>,
    @repository.getter('ReportUserRepository')
    protected reportUserRepositoryGetter: Getter<ReportUserRepository>,
  ) {
    super(Report, dataSource);
    this.reporters = this.createHasManyThroughRepositoryFactoryFor(
      'reporters',
      userRepositoryGetter,
      reportUserRepositoryGetter,
    );
    this.registerInclusionResolver(
      'reporters',
      this.reporters.inclusionResolver,
    );
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
    this.post = this.createBelongsToAccessorFor('post', postRepositoryGetter);
    this.registerInclusionResolver('post', this.post.inclusionResolver);
  }
}

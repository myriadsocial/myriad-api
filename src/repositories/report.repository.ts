import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Report, ReportRelations, User, Post} from '../models';
import {UserRepository} from './user.repository';
import {PostRepository} from './post.repository';

export class ReportRepository extends DefaultCrudRepository<
  Report,
  typeof Report.prototype.id,
  ReportRelations
> {
  public readonly reporter: BelongsToAccessor<User, typeof Report.prototype.id>;

  public readonly post: BelongsToAccessor<Post, typeof Report.prototype.id>;

  public readonly user: BelongsToAccessor<User, typeof Report.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('PostRepository')
    protected postRepositoryGetter: Getter<PostRepository>,
  ) {
    super(Report, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
    this.post = this.createBelongsToAccessorFor('post', postRepositoryGetter);
    this.registerInclusionResolver('post', this.post.inclusionResolver);
    this.reporter = this.createBelongsToAccessorFor(
      'reporter',
      userRepositoryGetter,
    );
    this.registerInclusionResolver('reporter', this.reporter.inclusionResolver);
  }
}

import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
  HasManyRepositoryFactory,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {
  Report,
  ReportRelations,
  User,
  Post,
  UserReport,
  Comment,
} from '../models';
import {UserRepository} from './user.repository';
import {PostRepository} from './post.repository';
import {UserReportRepository} from './user-report.repository';
import {CommentRepository} from '.';

export class ReportRepository extends DefaultCrudRepository<
  Report,
  typeof Report.prototype.id,
  ReportRelations
> {
  public readonly post: BelongsToAccessor<Post, typeof Report.prototype.id>;

  public readonly user: BelongsToAccessor<User, typeof Report.prototype.id>;

  public readonly comment: BelongsToAccessor<
    Comment,
    typeof Report.prototype.id
  >;

  public readonly reporters: HasManyRepositoryFactory<
    UserReport,
    typeof Report.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('PostRepository')
    protected postRepositoryGetter: Getter<PostRepository>,
    @repository.getter('CommentRepository')
    protected commentRepositoryGetter: Getter<CommentRepository>,
    @repository.getter('UserReportRepository')
    protected userReportRepositoryGetter: Getter<UserReportRepository>,
  ) {
    super(Report, dataSource);
    this.reporters = this.createHasManyRepositoryFactoryFor(
      'reporters',
      userReportRepositoryGetter,
    );
    this.registerInclusionResolver(
      'reporters',
      this.reporters.inclusionResolver,
    );
    this.user = this.createBelongsToAccessorFor(
      'reportedUser',
      userRepositoryGetter,
    );
    this.registerInclusionResolver('reportedUser', this.user.inclusionResolver);
    this.post = this.createBelongsToAccessorFor(
      'reportedPost',
      postRepositoryGetter,
    );
    this.registerInclusionResolver('reportedPost', this.post.inclusionResolver);
    this.comment = this.createBelongsToAccessorFor(
      'reportedComment',
      commentRepositoryGetter,
    );
    this.registerInclusionResolver(
      'reportedComment',
      this.comment.inclusionResolver,
    );
  }
}

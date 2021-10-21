import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {UserReport, UserReportRelations, User, Report} from '../models';
import {UserRepository} from './user.repository';
import {ReportRepository} from './report.repository';

export class UserReportRepository extends DefaultCrudRepository<
  UserReport,
  typeof UserReport.prototype.id,
  UserReportRelations
> {
  public readonly reporter: BelongsToAccessor<
    User,
    typeof UserReport.prototype.id
  >;

  public readonly report: BelongsToAccessor<
    Report,
    typeof UserReport.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
    @repository.getter('ReportRepository')
    protected reportRepositoryGetter: Getter<ReportRepository>,
  ) {
    super(UserReport, dataSource);
    this.report = this.createBelongsToAccessorFor(
      'report',
      reportRepositoryGetter,
    );
    this.registerInclusionResolver('report', this.report.inclusionResolver);
    this.reporter = this.createBelongsToAccessorFor(
      'reporter',
      userRepositoryGetter,
    );
    this.registerInclusionResolver('reporter', this.reporter.inclusionResolver);
  }
}

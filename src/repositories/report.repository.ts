import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  HasManyRepositoryFactory,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Report, ReportRelations, UserReport} from '../models';
import {UserReportRepository} from './user-report.repository';

export class ReportRepository extends DefaultCrudRepository<
  Report,
  typeof Report.prototype.id,
  ReportRelations
> {
  public readonly reporters: HasManyRepositoryFactory<
    UserReport,
    typeof Report.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
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
  }
}

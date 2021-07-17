import {Getter, inject} from '@loopback/core';
import {
  BelongsToAccessor,
  DefaultCrudRepository,
  repository,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Post, PublicMetric, PublicMetricRelations} from '../models';
import {PostRepository} from './post.repository';

export class PublicMetricRepository extends DefaultCrudRepository<
  PublicMetric,
  typeof PublicMetric.prototype.id,
  PublicMetricRelations
> {
  public readonly post: BelongsToAccessor<
    Post,
    typeof PublicMetric.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('PostRepository')
    protected postRepositoryGetter: Getter<PostRepository>,
  ) {
    super(PublicMetric, dataSource);
    this.post = this.createBelongsToAccessorFor('post', postRepositoryGetter);
    this.registerInclusionResolver('post', this.post.inclusionResolver);
  }
}

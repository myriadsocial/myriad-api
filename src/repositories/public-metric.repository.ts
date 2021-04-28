import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {PublicMetric, PublicMetricRelations, Post} from '../models';
import {PostRepository} from './post.repository';

export class PublicMetricRepository extends DefaultCrudRepository<
  PublicMetric,
  typeof PublicMetric.prototype.id,
  PublicMetricRelations
> {

  public readonly post: BelongsToAccessor<Post, typeof PublicMetric.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource, @repository.getter('PostRepository') protected postRepositoryGetter: Getter<PostRepository>,
  ) {
    super(PublicMetric, dataSource);
    this.post = this.createBelongsToAccessorFor('post', postRepositoryGetter,);
    this.registerInclusionResolver('post', this.post.inclusionResolver);
  }
}

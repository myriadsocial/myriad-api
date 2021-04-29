import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Asset, AssetRelations, Post} from '../models';
import {PostRepository} from './post.repository';

export class AssetRepository extends DefaultCrudRepository<
  Asset,
  typeof Asset.prototype.id,
  AssetRelations
> {

  public readonly post: BelongsToAccessor<Post, typeof Asset.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource, @repository.getter('PostRepository') protected postRepositoryGetter: Getter<PostRepository>,
  ) {
    super(Asset, dataSource);
    this.post = this.createBelongsToAccessorFor('post', postRepositoryGetter,);
    this.registerInclusionResolver('post', this.post.inclusionResolver);
  }
}

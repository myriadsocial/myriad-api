import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, HasManyRepositoryFactory, BelongsToAccessor, HasOneRepositoryFactory} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Post, PostRelations, Comment, People, Asset, User} from '../models';
import {CommentRepository} from './comment.repository';
import {PeopleRepository} from './people.repository';
import {AssetRepository} from './asset.repository';
import {UserRepository} from './user.repository';

export class PostRepository extends DefaultCrudRepository<
  Post,
  typeof Post.prototype.id,
  PostRelations
> {

  public readonly comments: HasManyRepositoryFactory<Comment, typeof Post.prototype.id>;

  public readonly people: BelongsToAccessor<People, typeof Post.prototype.id>;

  public readonly asset: HasOneRepositoryFactory<Asset, typeof Post.prototype.id>;

  public readonly user: BelongsToAccessor<User, typeof Post.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource, @repository.getter('CommentRepository') protected commentRepositoryGetter: Getter<CommentRepository>, @repository.getter('PeopleRepository') protected peopleRepositoryGetter: Getter<PeopleRepository>, @repository.getter('AssetRepository') protected assetRepositoryGetter: Getter<AssetRepository>, @repository.getter('UserRepository') protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(Post, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter,);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
    this.asset = this.createHasOneRepositoryFactoryFor('asset', assetRepositoryGetter);
    this.registerInclusionResolver('asset', this.asset.inclusionResolver);
    this.people = this.createBelongsToAccessorFor('people', peopleRepositoryGetter,);
    this.registerInclusionResolver('people', this.people.inclusionResolver);
    this.comments = this.createHasManyRepositoryFactoryFor('comments', commentRepositoryGetter,);
    this.registerInclusionResolver('comments', this.comments.inclusionResolver);
  }
}

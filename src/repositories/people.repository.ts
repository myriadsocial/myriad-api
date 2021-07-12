import {Getter, inject} from '@loopback/core';
import {
  DefaultCrudRepository,
  HasManyRepositoryFactory,
  HasOneRepositoryFactory,
  repository
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {People, PeopleRelations, Post, UserCredential, Tip} from '../models';
import {PostRepository} from './post.repository';
import {UserCredentialRepository} from './user-credential.repository';
import {TipRepository} from './tip.repository';

export class PeopleRepository extends DefaultCrudRepository<
  People,
  typeof People.prototype.id,
  PeopleRelations
> {

  public readonly userCredential: HasOneRepositoryFactory<UserCredential, typeof People.prototype.id>;

  public readonly posts: HasManyRepositoryFactory<Post, typeof People.prototype.id>;

  public readonly tips: HasManyRepositoryFactory<Tip, typeof People.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserCredentialRepository')
    protected userCredentialRepositoryGetter: Getter<UserCredentialRepository>,
    @repository.getter('PostRepository')
    protected postRepositoryGetter: Getter<PostRepository>, @repository.getter('TipRepository') protected tipRepositoryGetter: Getter<TipRepository>,
  ) {
    super(People, dataSource);
    this.tips = this.createHasManyRepositoryFactoryFor('tips', tipRepositoryGetter,);
    this.registerInclusionResolver('tips', this.tips.inclusionResolver);
    this.posts = this.createHasManyRepositoryFactoryFor('posts', postRepositoryGetter,);
    this.registerInclusionResolver('posts', this.posts.inclusionResolver);
    this.userCredential = this.createHasOneRepositoryFactoryFor('credential', userCredentialRepositoryGetter);
    this.registerInclusionResolver('credential', this.userCredential.inclusionResolver);
  }
}

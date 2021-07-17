import {Getter, inject} from '@loopback/core';
import {
  DefaultCrudRepository,
  HasManyRepositoryFactory,
  HasOneRepositoryFactory,
  repository,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {
  People,
  PeopleRelations,
  Post,
  UserCredential,
  PersonTip,
} from '../models';
import {PostRepository} from './post.repository';
import {UserCredentialRepository} from './user-credential.repository';
import {PersonTipRepository} from './person-tip.repository';

export class PeopleRepository extends DefaultCrudRepository<
  People,
  typeof People.prototype.id,
  PeopleRelations
> {
  public readonly userCredential: HasOneRepositoryFactory<
    UserCredential,
    typeof People.prototype.id
  >;

  public readonly posts: HasManyRepositoryFactory<
    Post,
    typeof People.prototype.id
  >;

  public readonly personTips: HasManyRepositoryFactory<
    PersonTip,
    typeof People.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserCredentialRepository')
    protected userCredentialRepositoryGetter: Getter<UserCredentialRepository>,
    @repository.getter('PostRepository')
    protected postRepositoryGetter: Getter<PostRepository>,
    @repository.getter('PersonTipRepository')
    protected personTipRepositoryGetter: Getter<PersonTipRepository>,
  ) {
    super(People, dataSource);
    this.personTips = this.createHasManyRepositoryFactoryFor(
      'personTips',
      personTipRepositoryGetter,
    );
    this.registerInclusionResolver(
      'personTips',
      this.personTips.inclusionResolver,
    );
    this.posts = this.createHasManyRepositoryFactoryFor(
      'posts',
      postRepositoryGetter,
    );
    this.registerInclusionResolver('posts', this.posts.inclusionResolver);
    this.userCredential = this.createHasOneRepositoryFactoryFor(
      'credential',
      userCredentialRepositoryGetter,
    );
    this.registerInclusionResolver(
      'credential',
      this.userCredential.inclusionResolver,
    );
  }
}

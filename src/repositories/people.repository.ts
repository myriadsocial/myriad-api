import {Getter, inject} from '@loopback/core';
import {
  DefaultCrudRepository,
  HasManyRepositoryFactory,
  HasOneRepositoryFactory,
  repository,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {People, PeopleRelations, Post, UserSocialMedia} from '../models';
import {PostRepository} from './post.repository';
import {UserSocialMediaRepository} from './user-social-media.repository';

export class PeopleRepository extends DefaultCrudRepository<
  People,
  typeof People.prototype.id,
  PeopleRelations
> {
  public readonly userSocialMedia: HasOneRepositoryFactory<
    UserSocialMedia,
    typeof People.prototype.id
  >;

  public readonly posts: HasManyRepositoryFactory<
    Post,
    typeof People.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserSocialMediaRepository')
    protected userSocialMediaRepositoryGetter: Getter<UserSocialMediaRepository>,
    @repository.getter('PostRepository')
    protected postRepositoryGetter: Getter<PostRepository>,
  ) {
    super(People, dataSource);
    this.posts = this.createHasManyRepositoryFactoryFor(
      'posts',
      postRepositoryGetter,
    );
    this.registerInclusionResolver('posts', this.posts.inclusionResolver);
    this.userSocialMedia = this.createHasOneRepositoryFactoryFor(
      'userSocialMedia',
      userSocialMediaRepositoryGetter,
    );
    this.registerInclusionResolver(
      'userSocialMedia',
      this.userSocialMedia.inclusionResolver,
    );
  }
}

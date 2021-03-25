import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, DefaultCrudRepository, repository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Topic, TopicRelations, User} from '../models';
import {UserRepository} from './user.repository';

export class TopicRepository extends DefaultCrudRepository<
  Topic,
  typeof Topic.prototype.id,
  TopicRelations
> {

  public readonly user: BelongsToAccessor<User, typeof Topic.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(Topic, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter,);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}

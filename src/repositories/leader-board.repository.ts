import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {LeaderBoard, LeaderBoardRelations, User} from '../models';
import {UserRepository} from './user.repository';

export class LeaderBoardRepository extends DefaultCrudRepository<
  LeaderBoard,
  typeof LeaderBoard.prototype.id,
  LeaderBoardRelations
> {
  public readonly user: BelongsToAccessor<
    User,
    typeof LeaderBoard.prototype.id
  >;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource,
    @repository.getter('UserRepository')
    protected userRepositoryGetter: Getter<UserRepository>,
  ) {
    super(LeaderBoard, dataSource);
    this.user = this.createBelongsToAccessorFor('user', userRepositoryGetter);
    this.registerInclusionResolver('user', this.user.inclusionResolver);
  }
}

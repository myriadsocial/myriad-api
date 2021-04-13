import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, HasManyRepositoryFactory, BelongsToAccessor} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {Post, PostRelations, Comment, People} from '../models';
import {CommentRepository} from './comment.repository';
import {PeopleRepository} from './people.repository';

export class PostRepository extends DefaultCrudRepository<
  Post,
  typeof Post.prototype.id,
  PostRelations
> {

  public readonly comments: HasManyRepositoryFactory<Comment, typeof Post.prototype.id>;

  public readonly people: BelongsToAccessor<People, typeof Post.prototype.id>;

  constructor(
    @inject('datasources.mongo') dataSource: MongoDataSource, @repository.getter('CommentRepository') protected commentRepositoryGetter: Getter<CommentRepository>, @repository.getter('PeopleRepository') protected peopleRepositoryGetter: Getter<PeopleRepository>,
  ) {
    super(Post, dataSource);
    this.people = this.createBelongsToAccessorFor('people', peopleRepositoryGetter,);
    this.registerInclusionResolver('people', this.people.inclusionResolver);
    this.comments = this.createHasManyRepositoryFactoryFor('comments', commentRepositoryGetter,);
    this.registerInclusionResolver('comments', this.comments.inclusionResolver);
  }
}

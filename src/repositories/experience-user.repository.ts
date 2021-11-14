import {inject, bind, BindingScope} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {ExperienceUser, ExperienceUserRelations} from '../models';

@bind({scope: BindingScope.SINGLETON})
export class ExperienceUserRepository extends DefaultCrudRepository<
  ExperienceUser,
  typeof ExperienceUser.prototype.id,
  ExperienceUserRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(ExperienceUser, dataSource);
  }
}

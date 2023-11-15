import {bind, BindingScope, inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {ExperienceEditor, ExperienceEditorRelations} from '../models';

@bind({scope: BindingScope.SINGLETON})
export class ExperienceEditorRepository extends DefaultCrudRepository<
  ExperienceEditor,
  typeof ExperienceEditor.prototype.id,
  ExperienceEditorRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(ExperienceEditor, dataSource);
  }
}

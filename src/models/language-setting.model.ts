import {Entity, model, property, belongsTo} from '@loopback/repository';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'languageSettings',
    },
    indexes: {
      uniqueUserIdIndex: {
        keys: {
          userId: 1,
        },
        options: {
          unique: true,
        },
      },
    },
  },
})
export class LanguageSetting extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id?: string;

  @property({
    type: 'string',
    required: false,
    default: 'en',
  })
  language: string;

  @belongsTo(() => User)
  userId: string;

  constructor(data?: Partial<LanguageSetting>) {
    super(data);
  }
}

export interface LanguageSettingRelations {
  // describe navigational properties here
}

export type LanguageSettingWithRelations = LanguageSetting &
  LanguageSettingRelations;

import {Entity, model, property, belongsTo} from '@loopback/repository';
import {AccountSettingType} from '../enums';
import {User} from './user.model';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'accountSettings',
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
export class AccountSetting extends Entity {
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
    jsonSchema: {
      enum: Object.values(AccountSettingType),
    },
    default: AccountSettingType.PUBLIC,
  })
  accountPrivacy: AccountSettingType;

  @property({
    type: 'string',
    required: false,
    jsonSchema: {
      enum: Object.values(AccountSettingType),
    },
    default: AccountSettingType.PUBLIC,
  })
  socialMediaPrivacy: AccountSettingType;

  @belongsTo(() => User)
  userId: string;

  constructor(data?: Partial<AccountSetting>) {
    super(data);
  }
}

export interface AccountSettingRelations {
  // describe navigational properties here
}

export type AccountSettingWithRelations = AccountSetting &
  AccountSettingRelations;

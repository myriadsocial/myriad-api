import {Entity, model, property, hasMany} from '@loopback/repository';
import {WalletType} from '../enums';
import {Currency} from './currency.model';

@model({
  settings: {
    mongodb: {
      collection: 'networks',
    },
    indexes: {
      uniquerpcURLIndex: {
        keys: {
          rpcURL: 1,
        },
        options: {
          unique: true,
        },
      },
    },
  },
})
export class Network extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: false,
    required: true,
  })
  id: string;

  @property({
    type: 'string',
    required: false,
  })
  chainId?: string;

  @property({
    type: 'string',
    required: true,
  })
  image: string;

  @property({
    type: 'string',
    required: true,
  })
  rpcURL: string;

  @property({
    type: 'string',
    required: true,
  })
  explorerURL: string;

  @property({
    type: 'string',
    required: false,
  })
  walletURL?: string;

  @property({
    type: 'string',
    required: false,
  })
  helperURL?: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: Object.values(WalletType),
    },
  })
  walletType: WalletType;

  @hasMany(() => Currency)
  currencies: Currency[];
}

export interface NetworkRelations {
  // describe navigational properties here
}

export type NetworkWithRelations = Network & NetworkRelations;

import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'publicMetrics',
    },
  },
})
export class PublicMetric extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id?: string;
}

export interface PublicMetricRelations {}

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'tokens',
    },
  },
})
export class Token extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id?: string;
}

export interface TokenRelations {}

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'userCredentials',
    },
  },
})
export class UserCredential extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id?: string;
}

export interface UserCredentialRelations {}

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'userTokens',
    },
  },
})
export class UserToken extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id?: string;
}

export interface UserTokenRelations {}

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'conversations',
    },
  },
})
export class Conversation extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id?: string;
}

export interface ConversationRelations {}

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'detailTransactions',
    },
  },
})
export class DetailTransaction extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id?: string;
}

export interface DetailTransactionRelations {}

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'tips',
    },
  },
})
export class Tip extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id?: string;
}

export interface TipRelations {}

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'dislikes',
    },
  },
})
export class Dislike extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id?: string;
}

export interface DislikeRelations {}

@model({
  settings: {
    strictObjectIDCoercion: true,
    mongodb: {
      collection: 'likes',
    },
  },
})
export class Like extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    mongodb: {
      dataType: 'ObjectId',
    },
  })
  id?: string;
}

export interface LikeRelations {}

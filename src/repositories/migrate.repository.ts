import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDataSource} from '../datasources';
import {
  Conversation,
  ConversationRelations,
  DetailTransaction,
  DetailTransactionRelations,
  Dislike,
  DislikeRelations,
  PublicMetric,
  PublicMetricRelations,
  Tip,
  TipRelations,
  Token,
  TokenRelations,
  UserCredential,
  UserCredentialRelations,
  UserToken,
  UserTokenRelations,
} from '../models';

export class PublicMetricRepository extends DefaultCrudRepository<
  PublicMetric,
  typeof PublicMetric.prototype.id,
  PublicMetricRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(PublicMetric, dataSource);
  }
}

export class TokenRepository extends DefaultCrudRepository<
  Token,
  typeof Token.prototype.id,
  TokenRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(Token, dataSource);
  }
}

export class UserCredentialRepository extends DefaultCrudRepository<
  UserCredential,
  typeof UserCredential.prototype.id,
  UserCredentialRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(UserCredential, dataSource);
  }
}

export class UserTokenRepository extends DefaultCrudRepository<
  UserToken,
  typeof UserToken.prototype.id,
  UserTokenRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(UserToken, dataSource);
  }
}

export class ConversationRepository extends DefaultCrudRepository<
  Conversation,
  typeof Conversation.prototype.id,
  ConversationRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(Conversation, dataSource);
  }
}

export class DetailTransactionRepository extends DefaultCrudRepository<
  DetailTransaction,
  typeof DetailTransaction.prototype.id,
  DetailTransactionRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(DetailTransaction, dataSource);
  }
}

export class TipRepository extends DefaultCrudRepository<
  Tip,
  typeof Tip.prototype.id,
  TipRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(Tip, dataSource);
  }
}

export class DislikeRepository extends DefaultCrudRepository<
  Dislike,
  typeof Dislike.prototype.id,
  DislikeRelations
> {
  constructor(@inject('datasources.mongo') dataSource: MongoDataSource) {
    super(Dislike, dataSource);
  }
}

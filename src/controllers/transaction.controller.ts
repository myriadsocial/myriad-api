import {intercept} from '@loopback/core';
import {
  AnyObject,
  Filter,
  FilterExcludingWhere,
  repository,
} from '@loopback/repository';
import {
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {CreateInterceptor, PaginationInterceptor} from '../interceptors';
import {Transaction} from '../models';
import {
  TransactionRepository,
  UserSocialMediaRepository,
} from '../repositories';
import {authenticate} from '@loopback/authentication';

export interface TransactionInfo {
  userId: string;
  walletId: string;
  currencyIds: string[];
}
@authenticate('jwt')
export class TransactionController {
  constructor(
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
    @repository(UserSocialMediaRepository)
    protected userSocialMediaRepository: UserSocialMediaRepository,
  ) {}

  @intercept(CreateInterceptor.BINDING_KEY)
  @post('/transactions')
  @response(200, {
    description: 'Transaction model instance',
    content: {'application/json': {schema: getModelSchemaRef(Transaction)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Transaction, {
            title: 'NewTransaction',
            exclude: ['id'],
          }),
        },
      },
    })
    transaction: Omit<Transaction, 'id'>,
  ): Promise<Transaction> {
    return this.transactionRepository.create(transaction);
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/transactions')
  @response(200, {
    description: 'Array of Transaction model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Transaction, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Transaction, {exclude: ['where', 'limit', 'skip', 'offset']})
    filter?: Filter<Transaction>,
  ): Promise<Transaction[]> {
    return this.transactionRepository.find(filter);
  }

  @authenticate.skip()
  @get('/transactions/{id}')
  @response(200, {
    description: 'Transaction model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Transaction, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Transaction, {exclude: 'where'})
    filter?: FilterExcludingWhere<Transaction>,
  ): Promise<Transaction> {
    return this.transactionRepository.findById(id, filter);
  }

  @patch('/transactions')
  async patch(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              userId: {
                type: 'string',
              },
              walletId: {
                type: 'string',
              },
              currencyIds: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    })
    transactionInfo: TransactionInfo,
  ): Promise<AnyObject> {
    const {userId, currencyIds} = transactionInfo;
    const socialMedias = await this.userSocialMediaRepository.find({
      where: {userId},
    });

    const promises: Promise<AnyObject>[] = socialMedias.map(e => {
      return this.transactionRepository.updateAll(
        {to: userId},
        {to: e.peopleId, currencyId: {inq: currencyIds}},
      );
    });

    return Promise.allSettled(promises);
  }
}

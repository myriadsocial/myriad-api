import {intercept} from '@loopback/core';
import {
  AnyObject,
  Filter,
  FilterExcludingWhere,
  repository,
} from '@loopback/repository';
import {get, getModelSchemaRef, param, response} from '@loopback/rest';
import {PaginationInterceptor} from '../interceptors';
import {Currency, Transaction} from '../models';
import {CurrencyRepository, TransactionRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
export class CurrencyController {
  constructor(
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/currencies')
  @response(200, {
    description: 'Array of Currency model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Currency, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Currency, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<Currency>,
    @param.query.boolean('top5Currencies') top5Currencies?: boolean,
    @param.query.number('limit') limit = 5,
  ): Promise<Currency[]> {
    if (top5Currencies) {
      const transactionCollection = (
        this.transactionRepository.dataSource.connector as AnyObject
      ).collection(Transaction.modelName);

      const result = await transactionCollection
        .aggregate([
          {
            $group: {
              _id: {currencyId: '$currencyId'},
              totalAmount: {$sum: '$amount'},
            },
          },
          {$sort: {totalAmount: -1}},
          {$limit: limit},
        ])
        .get();

      const data: AnyObject[] = [];
      const currencyIds = result.map((e: AnyObject) => e._id.currencyId);
      const currencies = await this.currencyRepository.find({
        where: {id: {inq: currencyIds}},
      });

      for (const coin of result) {
        const currency = currencies.find(({id}) => id === coin._id.currencyId);
        data.push({
          ...currency,
          amount: coin.totalAmount,
        });
      }

      return data as Currency[];
    }

    return this.currencyRepository.find(filter);
  }

  @get('/currencies/{id}')
  @response(200, {
    description: 'Currency model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Currency, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Currency, {exclude: 'where'})
    filter?: FilterExcludingWhere<Currency>,
  ): Promise<Currency> {
    return this.currencyRepository.findById(id, filter);
  }
}

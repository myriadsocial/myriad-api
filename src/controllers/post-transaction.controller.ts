import {intercept} from '@loopback/core';
import {Filter, repository} from '@loopback/repository';
import {get, getModelSchemaRef, param} from '@loopback/rest';
import {defaultFilterQuery} from '../helpers/filter-utils';
import {PaginationInterceptor} from '../interceptors';
import {Transaction} from '../models';
import {PostRepository} from '../repositories';

@intercept(PaginationInterceptor.BINDING_KEY)
export class PostTransactionController {
  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
  ) {}

  @get('/posts/{id}/transactions', {
    responses: {
      '200': {
        description: 'Transaction belonging to post',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Transaction)},
          },
        },
      },
    },
  })
  async getTransaction(
    @param.path.string('id') id: string,
    @param.query.number('page') page: number,
    @param.query.object('filter') filter?: Filter<Transaction>,
  ): Promise<Transaction[]> {
    filter = defaultFilterQuery(page, filter);
    return this.postRepository.transactions(id).find(filter);
  }
}

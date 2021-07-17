import {Filter, repository} from '@loopback/repository';
import {get, getModelSchemaRef, param} from '@loopback/rest';
import {Transaction} from '../models';
import {PostRepository, TransactionRepository} from '../repositories';

export class PostTransactionController {
  constructor(
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
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
    @param.query.object('filter') filter?: Filter<Transaction>,
  ): Promise<Transaction[]> {
    return this.postRepository.transactions(id).find(filter);
  }
}

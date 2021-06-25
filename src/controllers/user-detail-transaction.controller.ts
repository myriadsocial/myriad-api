import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  post,
  requestBody
} from '@loopback/rest';
import {DetailTransaction, User} from '../models';
import {UserRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';

@authenticate("jwt")
export class UserDetailTransactionController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
  ) { }

  @get('/users/{id}/detail-transactions', {
    responses: {
      '200': {
        description: 'Array of User has many DetailTransaction',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(DetailTransaction)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<DetailTransaction>,
  ): Promise<DetailTransaction[]> {
    return this.userRepository.detailTransactions(id).find(filter);
  }

  @post('/users/{id}/detail-transactions', {
    responses: {
      '200': {
        description: 'User model instance',
        content: {'application/json': {schema: getModelSchemaRef(DetailTransaction)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof User.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(DetailTransaction, {
            title: 'NewDetailTransactionInUser',
            exclude: ['id'],
            optional: ['userId']
          }),
        },
      },
    }) detailTransaction: Omit<DetailTransaction, 'id'>,
  ): Promise<DetailTransaction> {
    return this.userRepository.detailTransactions(id).create(detailTransaction);
  }

  @patch('/users/{id}/detail-transactions', {
    responses: {
      '200': {
        description: 'User.DetailTransaction PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(DetailTransaction, {partial: true}),
        },
      },
    })
    detailTransaction: Partial<DetailTransaction>,
    @param.query.object('where', getWhereSchemaFor(DetailTransaction)) where?: Where<DetailTransaction>,
  ): Promise<Count> {
    return this.userRepository.detailTransactions(id).patch(detailTransaction, where);
  }

  @del('/users/{id}/detail-transactions', {
    responses: {
      '200': {
        description: 'User.DetailTransaction DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(DetailTransaction)) where?: Where<DetailTransaction>,
  ): Promise<Count> {
    return this.userRepository.detailTransactions(id).delete(where);
  }
}

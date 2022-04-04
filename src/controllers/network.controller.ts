import {authenticate} from '@loopback/authentication';
import {intercept} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
  response,
  post,
  requestBody,
} from '@loopback/rest';
import {PaginationInterceptor} from '../interceptors';
import {Network} from '../models';
import {NetworkRepository} from '../repositories';

@authenticate('jwt')
export class NetworkController {
  constructor(
    @repository(NetworkRepository)
    public networkRepository: NetworkRepository,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/networks')
  @response(200, {
    description: 'Array of Network model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Network, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Network) filter?: Filter<Network>,
  ): Promise<Network[]> {
    return this.networkRepository.find(filter);
  }

  @get('/networks/{id}')
  @response(200, {
    description: 'Network model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Network, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Network, {exclude: 'where'})
    filter?: FilterExcludingWhere<Network>,
  ): Promise<Network> {
    return this.networkRepository.findById(id, filter);
  }

  @post('/networks')
  @response(200, {
    description: 'Network model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Network),
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Network, {
            title: 'NewNetwork',
          }),
        },
      },
    })
    network: Network,
  ): Promise<Network> {
    return this.networkRepository.create(network);
  }
}

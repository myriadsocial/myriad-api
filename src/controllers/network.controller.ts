import {authenticate} from '@loopback/authentication';
import {intercept, service} from '@loopback/core';
import {Filter, FilterExcludingWhere} from '@loopback/repository';
import {get, getModelSchemaRef, param, response} from '@loopback/rest';
import {PaginationInterceptor} from '../interceptors';
import {Network} from '../models';
import {NetworkService} from '../services';

@authenticate('jwt')
export class NetworkController {
  constructor(
    @service(NetworkService)
    public networkService: NetworkService,
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
    return this.networkService.find(filter);
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
    return this.networkService.findById(id, filter);
  }
}

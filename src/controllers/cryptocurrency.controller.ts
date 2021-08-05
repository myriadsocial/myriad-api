import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  HttpErrors,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {defaultFilterQuery} from '../helpers/filter-utils';
import {Cryptocurrency} from '../models';
import {CryptocurrencyRepository} from '../repositories';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class CryptocurrencyController {
  constructor(
    @repository(CryptocurrencyRepository)
    protected cryptocurrencyRepository: CryptocurrencyRepository,
  ) {}

  @post('/cryptocurrencies')
  @response(200, {
    description: 'Cryptocurrency model instance',
    content: {'application/json': {schema: getModelSchemaRef(Cryptocurrency)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Cryptocurrency, {
            title: 'NewCryptocurrency',
          }),
        },
      },
    })
    crypto: Cryptocurrency,
  ): Promise<Cryptocurrency> {
    crypto.id = crypto.id.toUpperCase();
    crypto.name = crypto.name.toLowerCase();
    crypto.rpcAddress = crypto.rpcAddress.toLowerCase();

    const foundCryptocurrency = await this.cryptocurrencyRepository.findOne({
      where: {
        id: crypto.id,
      },
    });

    if (foundCryptocurrency)
      throw new HttpErrors.UnprocessableEntity('Cryptocurrency already exists');

    return this.cryptocurrencyRepository.create(crypto);
  }

  @get('/cryptocurrencies')
  @response(200, {
    description: 'Array of Cryptocurrency model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Cryptocurrency, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.query.number('page') page: number,
    @param.filter(Cryptocurrency, {exclude: ['skip', 'offset']}) filter?: Filter<Cryptocurrency>,
  ): Promise<Cryptocurrency[]> {
    const newFilter = defaultFilterQuery(page, filter) as Filter<Cryptocurrency>;

    return this.cryptocurrencyRepository.find(newFilter);
  }

  @get('/cryptocurrencies/{id}')
  @response(200, {
    description: 'Cryptocurrency model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Cryptocurrency, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Cryptocurrency, {exclude: 'where'})
    filter?: FilterExcludingWhere<Cryptocurrency>,
  ): Promise<Cryptocurrency> {
    return this.cryptocurrencyRepository.findById(id.toUpperCase(), filter);
  }

  @patch('/cryptocurrencies/{id}')
  @response(204, {
    description: 'Cryptocurrency PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Cryptocurrency, {partial: true}),
        },
      },
    })
    token: Cryptocurrency,
  ): Promise<void> {
    await this.cryptocurrencyRepository.updateById(id.toUpperCase(), token);
  }

  @del('/cryptocurrencies/{id}')
  @response(204, {
    description: 'Cryptocurrency DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.cryptocurrencyRepository.deleteById(id);
  }
}

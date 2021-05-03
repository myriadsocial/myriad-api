import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  response,
} from '@loopback/rest';
import {Asset} from '../models';
import {AssetRepository} from '../repositories';

export class AssetController {
  constructor(
    @repository(AssetRepository)
    public assetRepository : AssetRepository,
  ) {}

  @post('/assets')
  @response(200, {
    description: 'Asset model instance',
    content: {'application/json': {schema: getModelSchemaRef(Asset)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Asset, {
            title: 'NewAsset',
            exclude: ['id'],
          }),
        },
      },
    })
    asset: Omit<Asset, 'id'>,
  ): Promise<Asset> {
    return this.assetRepository.create(asset);
  }

  // @get('/assets/count')
  // @response(200, {
  //   description: 'Asset model count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async count(
  //   @param.where(Asset) where?: Where<Asset>,
  // ): Promise<Count> {
  //   return this.assetRepository.count(where);
  // }

  @get('/assets')
  @response(200, {
    description: 'Array of Asset model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Asset, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Asset) filter?: Filter<Asset>,
  ): Promise<Asset[]> {
    return this.assetRepository.find(filter);
  }

  // @patch('/assets')
  // @response(200, {
  //   description: 'Asset PATCH success count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async updateAll(
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(Asset, {partial: true}),
  //       },
  //     },
  //   })
  //   asset: Asset,
  //   @param.where(Asset) where?: Where<Asset>,
  // ): Promise<Count> {
  //   return this.assetRepository.updateAll(asset, where);
  // }

  @get('/assets/{id}')
  @response(200, {
    description: 'Asset model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Asset, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Asset, {exclude: 'where'}) filter?: FilterExcludingWhere<Asset>
  ): Promise<Asset> {
    return this.assetRepository.findById(id, filter);
  }

  @patch('/assets/{id}')
  @response(204, {
    description: 'Asset PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Asset, {partial: true}),
        },
      },
    })
    asset: Asset,
  ): Promise<void> {
    await this.assetRepository.updateById(id, asset);
  }

  // @put('/assets/{id}')
  // @response(204, {
  //   description: 'Asset PUT success',
  // })
  // async replaceById(
  //   @param.path.string('id') id: string,
  //   @requestBody() asset: Asset,
  // ): Promise<void> {
  //   await this.assetRepository.replaceById(id, asset);
  // }

  @del('/assets/{id}')
  @response(204, {
    description: 'Asset DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.assetRepository.deleteById(id);
  }
}

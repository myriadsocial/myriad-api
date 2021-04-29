import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  Asset,
  Post,
} from '../models';
import {AssetRepository} from '../repositories';

export class AssetPostController {
  constructor(
    @repository(AssetRepository)
    public assetRepository: AssetRepository,
  ) { }

  @get('/assets/{id}/post', {
    responses: {
      '200': {
        description: 'Post belonging to Asset',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Post)},
          },
        },
      },
    },
  })
  async getPost(
    @param.path.string('id') id: typeof Asset.prototype.id,
  ): Promise<Post> {
    return this.assetRepository.post(id);
  }
}

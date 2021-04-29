import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  PublicMetric,
  Post,
} from '../models';
import {PublicMetricRepository} from '../repositories';

export class PublicMetricPostController {
  constructor(
    @repository(PublicMetricRepository)
    public publicMetricRepository: PublicMetricRepository,
  ) { }

  @get('/public-metrics/{id}/post', {
    responses: {
      '200': {
        description: 'Post belonging to PublicMetric',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Post)},
          },
        },
      },
    },
  })
  async getPost(
    @param.path.string('id') id: typeof PublicMetric.prototype.id,
  ): Promise<Post> {
    return this.publicMetricRepository.post(id);
  }
}

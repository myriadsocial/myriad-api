import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  Platform,
  User,
} from '../models';
import {PlatformRepository} from '../repositories';

export class PlatformUserController {
  constructor(
    @repository(PlatformRepository)
    public platformRepository: PlatformRepository,
  ) { }

  @get('/platforms/{id}/user', {
    responses: {
      '200': {
        description: 'User belonging to Platform',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(User)},
          },
        },
      },
    },
  })
  async getUser(
    @param.path.string('id') id: typeof Platform.prototype.id,
  ): Promise<User> {
    return this.platformRepository.user(id);
  }
}

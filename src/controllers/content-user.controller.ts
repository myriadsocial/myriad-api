import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  Content,
  User,
} from '../models';
import {ContentRepository} from '../repositories';

export class ContentUserController {
  constructor(
    @repository(ContentRepository)
    public contentRepository: ContentRepository,
  ) { }

  @get('/contents/{id}/user', {
    responses: {
      '200': {
        description: 'User belonging to Content',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(User)},
          },
        },
      },
    },
  })
  async getUser(
    @param.path.string('id') id: typeof Content.prototype.id,
  ): Promise<User> {
    return this.contentRepository.user(id);
  }
}

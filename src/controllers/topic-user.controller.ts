import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  Topic,
  User,
} from '../models';
import {TopicRepository} from '../repositories';

export class TopicUserController {
  constructor(
    @repository(TopicRepository)
    public topicRepository: TopicRepository,
  ) { }

  @get('/topics/{id}/user', {
    responses: {
      '200': {
        description: 'User belonging to Topic',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(User)},
          },
        },
      },
    },
  })
  async getUser(
    @param.path.string('id') id: typeof Topic.prototype.id,
  ): Promise<User> {
    return this.topicRepository.user(id);
  }
}

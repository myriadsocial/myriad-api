import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  Experience,
  User,
} from '../models';
import {ExperienceRepository} from '../repositories';

export class ExperienceUserController {
  constructor(
    @repository(ExperienceRepository)
    public experienceRepository: ExperienceRepository,
  ) { }

  @get('/experiences/{id}/user', {
    responses: {
      '200': {
        description: 'User belonging to Experience',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(User)},
          },
        },
      },
    },
  })
  async getUser(
    @param.path.string('id') id: typeof Experience.prototype.id,
  ): Promise<User> {
    return this.experienceRepository.user(id);
  }
}

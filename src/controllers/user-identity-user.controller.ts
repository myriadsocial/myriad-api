import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  UserIdentity,
  User,
} from '../models';
import {UserIdentityRepository} from '../repositories';

export class UserIdentityUserController {
  constructor(
    @repository(UserIdentityRepository)
    public userIdentityRepository: UserIdentityRepository,
  ) { }

  @get('/user-identities/{id}/user', {
    responses: {
      '200': {
        description: 'User belonging to UserIdentity',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(User)},
          },
        },
      },
    },
  })
  async getUser(
    @param.path.string('id') id: typeof UserIdentity.prototype.id,
  ): Promise<User> {
    return this.userIdentityRepository.user(id);
  }
}

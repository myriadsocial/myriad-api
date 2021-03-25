import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  UserCredential,
  User,
} from '../models';
import {UserCredentialRepository} from '../repositories';

export class UserCredentialUserController {
  constructor(
    @repository(UserCredentialRepository)
    public userCredentialRepository: UserCredentialRepository,
  ) { }

  @get('/user-credentials/{id}/user', {
    responses: {
      '200': {
        description: 'User belonging to UserCredential',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(User)},
          },
        },
      },
    },
  })
  async getUser(
    @param.path.string('id') id: typeof UserCredential.prototype.id,
  ): Promise<User> {
    return this.userCredentialRepository.user(id);
  }
}

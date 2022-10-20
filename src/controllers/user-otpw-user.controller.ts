import {repository} from '@loopback/repository';
import {param, get, getModelSchemaRef} from '@loopback/rest';
import {UserOtpw, User} from '../models';
import {UserOtpwRepository} from '../repositories';

export class UserOtpwUserController {
  constructor(
    @repository(UserOtpwRepository)
    public userOtpwRepository: UserOtpwRepository,
  ) {}

  @get('/user-otpws/{id}/user', {
    responses: {
      '200': {
        description: 'User belonging to UserOtpw',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(User)},
          },
        },
      },
    },
  })
  async getUser(
    @param.path.string('id') id: typeof UserOtpw.prototype.id,
  ): Promise<User> {
    return this.userOtpwRepository.user(id);
  }
}

import {authenticate} from '@loopback/authentication';
import {repository} from '@loopback/repository';
import {param, patch, response} from '@loopback/rest';
import {union} from 'lodash';
import {PermissionKeys} from '../../enums';
import {UserRepository} from '../../repositories';

export class AdminController {
  constructor(
    @repository(UserRepository)
    private userRepository: UserRepository,
  ) {}

  @authenticate({strategy: 'jwt', options: {required: [PermissionKeys.ADMIN]}})
  @patch('/admin/{userId}')
  @response(204, {
    description: 'Role PATCH success',
  })
  async patch(@param.path.string('userId') userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    const permissions = union(user.permissions, [PermissionKeys.ADMIN]);

    return this.userRepository.updateById(userId, {
      permissions,
      updatedAt: new Date().toString(),
    });
  }
}

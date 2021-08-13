import {repository} from '@loopback/repository';
import {MigrationScript} from 'loopback4-migration';
import {User} from '../models';
import {UserRepository} from '../repositories';

export class UpdateUsers implements MigrationScript {
  version = '0.1.1';
  scriptName = UpdateUsers.name;
  description = 'removed unused field in User';

  constructor(
    @repository(UserRepository)
    private userRepository: UserRepository,
  ) {}

  async up(): Promise<void> {
    await (this.userRepository.dataSource.connector as any).collection(User.modelName).updateMany(
      {},
      {
        $unset: {
          is_online: '',
          skip_tour: '',
          anonymous: '',
        },
        $rename: {
          username: 'name',
        },
      },
    );
  }
}

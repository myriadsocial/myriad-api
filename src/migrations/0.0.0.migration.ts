import {repository} from '@loopback/repository';
import {MigrationScript, migrationScript} from 'loopback4-migration';
import {config} from '../config';
import {DefaultCurrencyType} from '../enums';
import {UserRepository} from '../repositories';
import {BcryptHasher} from '../services/authentication/hash.password.service';

@migrationScript()
export class MigrationScript000 implements MigrationScript {
  version = '0.0.0';

  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
  ) {}

  async up(): Promise<void> {
    await this.createUsers();
  }

  async createUsers(): Promise<void> {
    await this.userRepository.deleteAll({
      or: [
        {
          name: {regexp: new RegExp('myriad', 'i')},
          username: {regexp: new RegExp('myriad', 'i')},
        },
      ],
    });

    const hasher = new BcryptHasher();
    const password = await hasher.hashPassword(
      config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY,
    );

    const user = await this.userRepository.create({
      id: config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY,
      password: password,
      name: 'Myriad Official',
      username: 'myriad_official',
      profilePictureURL:
        'https://pbs.twimg.com/profile_images/1407599051579617281/-jHXi6y5_400x400.jpg',
      bannerImageUrl:
        'https://pbs.twimg.com/profile_banners/1358714439583690753/1624432887/1500x500',
      bio: 'A social metaverse & metasocial network on web3, pulling content from mainstream social media and turning every post into a tipping wallet.',
      websiteURL: 'https://www.myriad.social/',
    });

    await this.userRepository.accountSetting(user.id).create({});
    await this.userRepository.notificationSetting(user.id).create({});
    await this.userRepository.leaderboard(user.id).create({});
    await this.userRepository.currencies(user.id).delete({
      id: DefaultCurrencyType.MYRIA,
    });
    await this.userRepository.currencies(user.id).create({
      id: DefaultCurrencyType.MYRIA,
      decimal: 18,
      image:
        'https://pbs.twimg.com/profile_images/1407599051579617281/-jHXi6y5_400x400.jpg',
      rpcURL: config.MYRIAD_RPC_WS_URL,
      native: true,
      networkType: 'substrate',
      exchangeRate: false,
    });
  }
}

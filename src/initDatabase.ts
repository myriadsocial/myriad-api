import {BootMixin} from '@loopback/boot';
import {ApplicationConfig} from '@loopback/core';
import {RepositoryMixin, SchemaMigrationOptions} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {ServiceMixin} from '@loopback/service-proxy';
import {DefaultCurrencyType, StatusType} from './enums';
import {DateUtils} from './helpers/date-utils';
import {PolkadotJs} from './helpers/polkadotJs-utils';
import {ExtendedPost} from './interfaces';
import {Currency, People, Post, User, UserExperience} from './models';
import {
  AuthCredentialRepository,
  AuthenticationRepository,
  CommentRepository,
  CurrencyRepository,
  ExperienceRepository,
  FriendRepository,
  LikeRepository,
  NotificationRepository,
  PeopleRepository,
  PostRepository,
  QueueRepository,
  RefreshTokenRepository,
  TagRepository,
  TransactionRepository,
  UserCurrencyRepository,
  UserExperienceRepository,
  UserRepository,
  UserSocialMediaRepository,
} from './repositories';
import currencies from './seed-data/currencies.json';
import peopleSeed from './seed-data/people.json';
import postSeed from './seed-data/posts.json';
import userSeed from './seed-data/users.json';

export {ApplicationConfig};

export class InitDatabase extends BootMixin(ServiceMixin(RepositoryMixin(RestApplication))) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    this.projectRoot = __dirname;
    // Customize @loopback/boot Booter Conventions here
    this.bootOptions = {
      controllers: {
        // Customize ControllerBooter Conventions here
        dirs: ['controllers'],
        extensions: ['.controller.js'],
        nested: true,
      },
    };
  }

  async migrateSchema(options?: SchemaMigrationOptions) {
    await super.migrateSchema(options);

    const {
      userRepository,
      currencyRepository,
      userCurrencyRepository,
      peopleRepository,
      tagRepository,
      postRepository,
      experienceRepository,
      userExperienceRepository,
    } = await this.getRepositories();

    const userSeedData = this.prepareUserSeed(userSeed as User[]);
    const currencySeedData = this.prepareCurrencySeed(currencies as Currency[]);
    const newUsers = await userRepository.createAll(userSeedData);
    const newPeople = await peopleRepository.createAll(peopleSeed);

    await currencyRepository.createAll(currencySeedData);
    await this.addWalletAddress(newPeople, peopleRepository);

    const postSeedData = this.preparePostSeed(
      newPeople,
      newUsers[0],
      postSeed as unknown as Omit<ExtendedPost, 'id'>[],
    );

    const newPosts = await postRepository.createAll(postSeedData);

    await this.createUserCurrency(newUsers, userCurrencyRepository);
    await this.createTags(newPosts, tagRepository);
    await this.createExperience(
      newUsers,
      newPeople,
      experienceRepository,
      userExperienceRepository,
    );

    const userExperience = await userExperienceRepository.find();
    await this.defaultUserExperience(newUsers, userExperience, userRepository);
  }

  async getRepositories() {
    const authCredentialRepository = await this.getRepository(AuthCredentialRepository);
    const authenticationRepository = await this.getRepository(AuthenticationRepository);
    const commentRepository = await this.getRepository(CommentRepository);
    const currencyRepository = await this.getRepository(CurrencyRepository);
    const experienceRepository = await this.getRepository(ExperienceRepository);
    const friendRepository = await this.getRepository(FriendRepository);
    const likeRepository = await this.getRepository(LikeRepository);
    const notificationRepository = await this.getRepository(NotificationRepository);
    const peopleRepository = await this.getRepository(PeopleRepository);
    const postRepository = await this.getRepository(PostRepository);
    const queueRepository = await this.getRepository(QueueRepository);
    const refreshTokenRepository = await this.getRepository(RefreshTokenRepository);
    const tagRepository = await this.getRepository(TagRepository);
    const transactionRepository = await this.getRepository(TransactionRepository);
    const userSocialMediaRepository = await this.getRepository(UserSocialMediaRepository);
    const userCurrencyRepository = await this.getRepository(UserCurrencyRepository);
    const userExperienceRepository = await this.getRepository(UserExperienceRepository);
    const userRepository = await this.getRepository(UserRepository);

    await userCurrencyRepository.deleteAll();
    await authCredentialRepository.deleteAll();
    await authenticationRepository.deleteAll();
    await commentRepository.deleteAll();
    await currencyRepository.deleteAll();
    await experienceRepository.deleteAll();
    await friendRepository.deleteAll();
    await likeRepository.deleteAll();
    await notificationRepository.deleteAll();
    await peopleRepository.deleteAll();
    await postRepository.deleteAll();
    await queueRepository.deleteAll();
    await refreshTokenRepository.deleteAll();
    await tagRepository.deleteAll();
    await transactionRepository.deleteAll();
    await userSocialMediaRepository.deleteAll();
    await userExperienceRepository.deleteAll();
    await userRepository.deleteAll();

    return {
      currencyRepository,
      userRepository,
      userCurrencyRepository,
      peopleRepository,
      postRepository,
      tagRepository,
      experienceRepository,
      userExperienceRepository,
    };
  }

  prepareUserSeed(users: User[]) {
    const {getKeyring, getHexPublicKey, generateSeed} = new PolkadotJs();

    return users.map((user: User) => {
      const seed = generateSeed();
      const pair = getKeyring(process.env.MYRIAD_CRYPTO_TYPE).createFromUri(seed + '', {
        name: user.name,
      });
      const name = user.name ?? '';

      return {
        ...user,
        id: getHexPublicKey(pair),
        bio: `Hello, my name is ${name}`,
        createdAt: new Date().toString(),
        updatedAt: new Date().toString(),
      };
    });
  }

  preparePostSeed(people: People[], user: User, posts: Omit<ExtendedPost, 'id'>[]) {
    for (const person of people) {
      const personAccountId = person.originUserId;

      for (const post of posts) {
        const postAccountId = post.platformUser?.originUserId;

        if (personAccountId === postAccountId) {
          delete post.platformUser;

          post.peopleId = person.id;
          post.createdBy = user.id;
          post.createdAt = new Date().toString();
          post.updatedAt = new Date().toString();
        }
      }
    }

    return posts;
  }

  prepareCurrencySeed(currenciesSeed: Currency[]): Currency[] {
    return currenciesSeed.map(currency => {
      currency.createdAt = new Date().toString();
      currency.updatedAt = new Date().toString();

      return currency;
    });
  }

  async createUserCurrency(
    users: User[],
    userCurrencyRepository: UserCurrencyRepository,
  ): Promise<void> {
    for (const user of users) {
      await userCurrencyRepository.createAll([
        {
          userId: user.id,
          currencyId: DefaultCurrencyType.MYR,
        },
        {
          userId: user.id,
          currencyId: DefaultCurrencyType.AUSD,
        },
      ]);
    }
  }

  async createExperience(
    users: User[],
    people: People[],
    experienceRepository: ExperienceRepository,
    userExperienceRepository: UserExperienceRepository,
  ): Promise<void> {
    const filterPeople = people
      .filter(person => {
        if (person.username === 'gavofyork' || person.username === 'CryptoChief') {
          return true;
        }

        return false;
      })
      .map(person => {
        return {
          ...person,
          status: StatusType.NONE,
        };
      });

    for (const user of users) {
      const newExperience = await experienceRepository.create({
        name: user.name + ' experience',
        tags: [
          {
            id: 'blockchain',
            status: StatusType.NONE,
          },
          {
            id: 'cryptocurrency',
            status: StatusType.NONE,
          },
          {
            id: 'technology',
            status: StatusType.NONE,
          },
        ],
        people: filterPeople,
        createdAt: new Date().toString(),
        updatedAt: new Date().toString(),
        description: 'This is about blockchain and cryptocurrency',
        createdBy: user.id,
      });

      await userExperienceRepository.create({
        userId: user.id,
        experienceId: newExperience.id,
      });
    }
  }

  async createTags(posts: Post[], tagRepository: TagRepository): Promise<void> {
    const dateUtils = new DateUtils();

    for (const post of posts) {
      let {tags} = post;

      if (!tags) tags = [];

      for (const tag of tags) {
        const foundTag = await tagRepository.findOne({
          where: {
            or: [
              {
                id: tag,
              },
              {
                id: tag.toLowerCase(),
              },
              {
                id: tag.toUpperCase(),
              },
            ],
          },
        });

        if (!foundTag) {
          await tagRepository.create({
            id: tag,
            count: 1,
            createdAt: new Date().toString(),
            updatedAt: new Date().toString(),
          });
        } else {
          await tagRepository.updateById(foundTag.id, {
            updatedAt: new Date().toString(),
            count: dateUtils.isToday(foundTag.updatedAt) ? 1 : foundTag.count + 1,
          });
        }
      }
    }
  }

  async addWalletAddress(people: People[], peopleRepository: PeopleRepository): Promise<void> {
    for (const person of people) {
      const {getKeyring, getHexPublicKey} = new PolkadotJs();
      const newKey = getKeyring(process.env.MYRIAD_CRYPTO_TYPE).addFromUri('//' + person.id);

      await peopleRepository.updateById(person.id, {
        walletAddress: getHexPublicKey(newKey),
      });
    }
  }

  async defaultUserExperience(
    users: User[],
    userExperiences: UserExperience[],
    userRepository: UserRepository,
  ): Promise<void> {
    for (const user of users) {
      const userExperience = userExperiences.find(e => e.userId === user.id);

      if (userExperience) {
        await userRepository.updateById(user.id, {
          onTimeline: userExperience.experienceId,
        });
      }
    }
  }
}

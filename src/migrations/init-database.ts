import {repository} from '@loopback/repository';
import {config} from '../configs';
import currencies from '../data-seed/currencies.json';
import people from '../data-seed/people.json';
import posts from '../data-seed/posts.json';
import users from '../data-seed/users.json';
import {DefaultCurrencyType, StatusType} from '../enums';
import {ExtendedPost} from '../interfaces';
import {User, UserCurrency} from '../models';
import {
  CurrencyRepository,
  ExperienceRepository,
  PeopleRepository,
  PostRepository,
  TagRepository,
  UserCurrencyRepository,
  UserExperienceRepository,
  UserRepository,
} from '../repositories';
import {DateUtils} from '../utils/date-utils';
import {PolkadotJs} from '../utils/polkadotJs-utils';

export class InitDatabase {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(UserCurrencyRepository)
    protected userCurrencyRepository: UserCurrencyRepository,
    @repository(TagRepository)
    protected tagRepository: TagRepository,
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
    @repository(UserExperienceRepository)
    protected userExperienceRepository: UserExperienceRepository,
  ) {}

  async createUsers(): Promise<void> {
    const {getKeyring, getHexPublicKey, generateSeed} = new PolkadotJs();

    const newUsers = await Promise.all(
      users.map((user: any) => {
        const seed = generateSeed();
        const pair = getKeyring().createFromUri(seed + '', {
          name: user.name,
        });

        user.id = getHexPublicKey(pair);
        user.bio = `Hello, my name is ${user.name}`;
        user.createdAt = new Date().toString();
        user.updatedAt = new Date().toString();

        return this.userRepository.create(user);
      }),
    );

    await this.createUserCurrencies(newUsers);
    await this.createExperience(newUsers);
  }

  async createUserCurrencies(users: User[]): Promise<void> {
    const newUserCurrencies: Promise<UserCurrency>[] = [];

    users.forEach(user => {
      newUserCurrencies.push(
        this.userCurrencyRepository.create({
          userId: user.id,
          currencyId: DefaultCurrencyType.MYRIA,
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
        } as UserCurrency),
      );

      newUserCurrencies.push(
        this.userCurrencyRepository.create({
          userId: user.id,
          currencyId: DefaultCurrencyType.AUSD,
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
        } as UserCurrency),
      );
    });

    await Promise.all(newUserCurrencies);
  }

  async createCurrencies(): Promise<void> {
    const newCurrencies = [
      {
        ...currencies[0],
        createdAt: new Date().toString(),
        updatedAt: new Date().toString(),
      },
      {
        id: DefaultCurrencyType.MYRIA,
        name: 'myriad',
        decimal: 12,
        image: 'https://pbs.twimg.com/profile_images/1407599051579617281/-jHXi6y5_400x400.jpg',
        addressType: 42,
        rpcURL: config.MYRIAD_WS_RPC,
        native: true,
        createdAt: new Date().toString(),
        updatedAt: new Date().toString(),
      },
    ];

    await this.currencyRepository.createAll(newCurrencies);
  }

  async createPeople(): Promise<void> {
    const {getKeyring, getHexPublicKey} = new PolkadotJs();
    const newPeople = await this.peopleRepository.createAll(people);

    await Promise.all(
      newPeople.map(person => {
        const newKey = getKeyring().addFromUri('//' + person.id);
        const walletAddress = getHexPublicKey(newKey);
        return this.peopleRepository.updateById(person.id, {
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
          walletAddress: walletAddress,
        });
      }),
    );
  }

  async createPost(): Promise<void> {
    await Promise.all(
      posts.map(async post => {
        const people = await this.peopleRepository.findOne({
          where: {
            originUserId: post.platformUser ? post.platformUser.originUserId : '',
          },
        });

        if (people) {
          const newPost = {
            ...post,
            peopleId: people.id,
            createdAt: new Date().toString(),
            updatedAt: new Date().toString(),
          } as ExtendedPost;

          delete newPost.platformUser;

          return this.postRepository.create(newPost);
        }

        return null;
      }),
    );

    await this.createTags(posts as ExtendedPost[]);
  }

  async createTags(posts: ExtendedPost[]): Promise<void> {
    const dateUtils = new DateUtils();

    for (const post of posts) {
      let {tags} = post;

      if (!tags) tags = [];

      for (const tag of tags) {
        const foundTag = await this.tagRepository.findOne({
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
          await this.tagRepository.create({
            id: tag,
            count: 1,
            createdAt: new Date().toString(),
            updatedAt: new Date().toString(),
          });
        } else {
          await this.tagRepository.updateById(foundTag.id, {
            updatedAt: new Date().toString(),
            count: dateUtils.isToday(foundTag.updatedAt) ? 1 : foundTag.count + 1,
          });
        }
      }
    }
  }

  async createExperience(users: User[]): Promise<void> {
    const people = await this.peopleRepository.find();
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
      const newExperience = await this.experienceRepository.create({
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

      await this.userExperienceRepository.create({
        userId: user.id,
        experienceId: newExperience.id,
        createdAt: new Date().toString(),
        updatedAt: new Date().toString(),
      });

      await this.userRepository.updateById(user.id, {onTimeline: newExperience.id});
    }
  }
}

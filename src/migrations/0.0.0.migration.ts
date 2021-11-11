import {repository} from '@loopback/repository';
import {MigrationScript, migrationScript} from 'loopback4-migration';
import {config} from '../config';
import {DefaultCurrencyType} from '../enums';
import {ExtendedPost} from '../interfaces';
import {Currency, People, Post, User} from '../models';
import {
  CurrencyRepository,
  PeopleRepository,
  PostRepository,
  TagRepository,
  UserRepository,
} from '../repositories';
import {DateUtils} from '../utils/date-utils';
import {PolkadotJs} from '../utils/polkadotJs-utils';
import currenciesSeed from '../data-seed/currencies.json';
import usersSeed from '../data-seed/users.json';

/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  @typescript-eslint/naming-convention */
@migrationScript()
export class MigrationScript000 implements MigrationScript {
  version = '0.0.0';

  constructor(
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(TagRepository)
    protected tagRepository: TagRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
  ) {}

  async up(): Promise<void> {
    await this.createCurrencies(currenciesSeed as unknown as Currency[]);
    await this.createUsers(usersSeed as User[]);
  }

  async createUsers(users: User[]): Promise<void> {
    const {getKeyring, getHexPublicKey} = new PolkadotJs();

    await this.userRepository.deleteAll({
      name: {regexp: new RegExp('myriad', 'i')},
    });

    await Promise.all(
      users.map(async user => {
        if (user.name === 'Myriad Official') {
          const mnemonic = config.MYRIAD_MNEMONIC;
          const pair = getKeyring().addFromMnemonic(mnemonic);

          user.id = getHexPublicKey(pair);
        }

        user.createdAt = new Date().toString();
        user.updatedAt = new Date().toString();

        user.username =
          user.username ??
          user.name.replace(/\s+/g, '').toLowerCase() +
            '.' +
            Math.random().toString(36).substr(2, 9);

        return this.userRepository.create(user);
      }),
    );
  }

  async createCurrencies(currencies: Currency[]): Promise<void> {
    currencies[0].createdAt = new Date().toString();
    currencies[0].updatedAt = new Date().toString();

    const newCurrencies = [
      ...currencies,
      {
        id: DefaultCurrencyType.MYRIA,
        decimal: 12,
        image:
          'https://pbs.twimg.com/profile_images/1407599051579617281/-jHXi6y5_400x400.jpg',
        rpcURL: config.MYRIAD_WS_RPC,
        native: true,
        createdAt: new Date().toString(),
        updatedAt: new Date().toString(),
      },
    ];

    try {
      await this.currencyRepository.createAll(newCurrencies);
    } catch {
      // ignore
    }
  }

  async createPeople(people: People[]): Promise<void> {
    const {getKeyring, getHexPublicKey} = new PolkadotJs();

    const filterPeople = (
      await Promise.all(
        people.map(async person => {
          const collection = (
            this.peopleRepository.dataSource.connector as any
          ).collection(People.modelName);

          const foundPeople = await collection
            .aggregate([
              {
                $match: {
                  platform_account_id: person.originUserId,
                },
              },
            ])
            .get();

          if (foundPeople.length > 0) {
            return null;
          }

          return person;
        }),
      )
    ).filter(person => person !== null);

    if (filterPeople.length > 0) {
      const newPeople = await this.peopleRepository.createAll(
        filterPeople as People[],
      );

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
  }

  async createPost(posts: ExtendedPost[]): Promise<void> {
    const {getKeyring, getHexPublicKey} = new PolkadotJs();
    const newPosts = (
      await Promise.all(
        posts.map(async post => {
          const postCollection = (
            this.postRepository.dataSource.connector as any
          ).collection(Post.modelName);

          const foundPost = await postCollection.aggregate([
            {$match: {textId: post.originPostId}},
          ]);

          if (foundPost.length > 0) return null;

          const people = await this.peopleRepository.findOne({
            where: {
              originUserId: post.platformUser
                ? post.platformUser.originUserId
                : '',
            },
          });

          if (people) {
            const mnemonic = config.MYRIAD_MNEMONIC;
            const pair = getKeyring().addFromMnemonic(mnemonic);

            post.peopleId = people.id;
            post.createdAt = new Date().toString();
            post.updatedAt = new Date().toString();
            post.createdBy = getHexPublicKey(pair);

            delete post.platformUser;

            return this.postRepository.create(post);
          }

          return null;
        }),
      )
    ).filter(post => post !== null);

    await this.createTags(newPosts as Post[]);
  }

  async createTags(posts: Post[]): Promise<void> {
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
            count: dateUtils.isToday(foundTag.updatedAt)
              ? 1
              : foundTag.count + 1,
          });
        }
      }
    }
  }
}

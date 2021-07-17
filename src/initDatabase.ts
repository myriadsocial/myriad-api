import {BootMixin} from '@loopback/boot';
import {ApplicationConfig} from '@loopback/core';
import {RepositoryMixin, SchemaMigrationOptions} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {ServiceMixin} from '@loopback/service-proxy';
import {Keyring} from '@polkadot/api';
import {u8aToHex} from '@polkadot/util';
import {mnemonicGenerate} from '@polkadot/util-crypto';
import {
  CommentRepository,
  ConversationRepository,
  TransactionHistoryRepository,
  ExperienceRepository,
  FriendRepository,
  LikeRepository,
  PeopleRepository,
  PostRepository,
  PublicMetricRepository,
  QueueRepository,
  SavedExperienceRepository,
  TagRepository,
  CryptocurrencyRepository,
  TransactionRepository,
  UserCredentialRepository,
  UserRepository,
  UserCryptoRepository,
  AuthenticationRepository,
  AuthCredentialRepository,
  RefreshTokenRepository,
  PostTipRepository,
  PersonTipRepository,
} from './repositories';
import peopleSeed from './seed-data/people.json';
import postSeed from './seed-data/posts.json';
import cryptocurrency from './seed-data/cryptocurrencies.json';
import userSeed from './seed-data/users.json';
import {DefaultCrypto} from './enums';
import {People, Post} from './models';
import {User} from './interfaces';

export {ApplicationConfig};

export class InitDatabase extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
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
      cryptocurrencyRepository,
      userCryptoRepository,
      peopleRepository,
      tagRepository,
      postRepository,
      postTipRepository,
      publicMetricRepository,
    } = await this.getRepositories();

    const userSeedData = this.prepareUserSeed(userSeed);

    await cryptocurrencyRepository.createAll(cryptocurrency);
    const newUsers = await userRepository.createAll(userSeedData);
    const newPeople = await peopleRepository.createAll(peopleSeed);

    const postSeedData = this.preparePostSeed(
      newPeople,
      postSeed as Omit<Post, 'id'>[],
    );

    for (const user of newUsers) {
      await userCryptoRepository.createAll([
        {
          userId: user.id,
          cryptocurrencyId: DefaultCrypto.MYR,
        },
        {
          userId: user.id,
          cryptocurrencyId: DefaultCrypto.AUSD,
        },
      ]);
    }

    for (const post of postSeedData) {
      let {tags} = post;
      const newKey = this.createKeyring().addFromUri('//' + post.peopleId);

      post.walletAddress = u8aToHex(newKey.publicKey);

      const newPost = await postRepository.create(post);

      await publicMetricRepository.create({postId: newPost.id});
      await postTipRepository.create({
        postId: newPost.id,
        cryptocurrencyId: DefaultCrypto.AUSD,
        total: 0,
      });

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
          const oneDay: number = 60 * 60 * 24 * 1000;
          const isOneDay: boolean =
            new Date().getTime() - new Date(foundTag.updatedAt).getTime() >
            oneDay;

          await tagRepository.updateById(foundTag.id, {
            updatedAt: new Date().toString(),
            count: isOneDay ? 1 : foundTag.count + 1,
          });
        }
      }
    }
  }

  async getRepositories() {
    const tagRepository = await this.getRepository(TagRepository);
    const postRepository = await this.getRepository(PostRepository);
    const peopleRepository = await this.getRepository(PeopleRepository);
    const transactionRepository = await this.getRepository(
      TransactionRepository,
    );
    const userRepository = await this.getRepository(UserRepository);
    const savedExperienceRepository = await this.getRepository(
      SavedExperienceRepository,
    );
    const experienceRepository = await this.getRepository(ExperienceRepository);
    const userCredRepository = await this.getRepository(
      UserCredentialRepository,
    );
    const commentRepository = await this.getRepository(CommentRepository);
    const publicMetricRepository = await this.getRepository(
      PublicMetricRepository,
    );
    const likeRepository = await this.getRepository(LikeRepository);
    const conversationRepository = await this.getRepository(
      ConversationRepository,
    );
    const friendRepository = await this.getRepository(FriendRepository);
    const cryptocurrencyRepository = await this.getRepository(
      CryptocurrencyRepository,
    );
    const transactionHistoryRepository = await this.getRepository(
      TransactionHistoryRepository,
    );
    const userCryptoRepository = await this.getRepository(UserCryptoRepository);
    const queueRepository = await this.getRepository(QueueRepository);
    const authenticationRepository = await this.getRepository(
      AuthenticationRepository,
    );
    const authCredentialRepository = await this.getRepository(
      AuthCredentialRepository,
    );
    const refreshTokenRepository = await this.getRepository(
      RefreshTokenRepository,
    );
    const postTipRepository = await this.getRepository(PostTipRepository);
    const personTipRepository = await this.getRepository(PersonTipRepository);

    await likeRepository.deleteAll();
    await conversationRepository.deleteAll();
    await tagRepository.deleteAll();
    await postRepository.deleteAll();
    await peopleRepository.deleteAll();
    await transactionRepository.deleteAll();
    await userRepository.deleteAll();
    await savedExperienceRepository.deleteAll();
    await experienceRepository.deleteAll();
    await userCredRepository.deleteAll();
    await commentRepository.deleteAll();
    await publicMetricRepository.deleteAll();
    await friendRepository.deleteAll();
    await cryptocurrencyRepository.deleteAll();
    await userCryptoRepository.deleteAll();
    await transactionHistoryRepository.deleteAll();
    await queueRepository.deleteAll();
    await authenticationRepository.deleteAll();
    await authCredentialRepository.deleteAll();
    await refreshTokenRepository.deleteAll();
    await postTipRepository.deleteAll();
    await personTipRepository.deleteAll();

    return {
      cryptocurrencyRepository,
      userRepository,
      userCryptoRepository,
      peopleRepository,
      postRepository,
      publicMetricRepository,
      tagRepository,
      postTipRepository,
    };
  }

  prepareUserSeed(users: User[]) {
    return users.map((user: User) => {
      const seed = mnemonicGenerate();
      const pair = this.createKeyring().createFromUri(seed + '', {
        name: user.name,
      });
      const name = user.name ?? '';

      return {
        ...user,
        username: name.toLowerCase(),
        id: u8aToHex(pair.publicKey),
        bio: `Hello, my name is ${name}`,
        createdAt: new Date().toString(),
        updatedAt: new Date().toString(),
      };
    });
  }

  preparePostSeed(people: People[], posts: Omit<Post, 'id'>[]) {
    for (const person of people) {
      const personAccountId = person.platformAccountId;

      for (const post of posts) {
        const postAccountId = post.platformUser?.platformAccountId;

        if (personAccountId === postAccountId) {
          post.peopleId = person.id;
          post.createdAt = new Date().toString();
          post.updatedAt = new Date().toString();
        }
      }
    }

    return posts;
  }

  createKeyring() {
    return new Keyring({
      type: 'sr25519',
    });
  }
}

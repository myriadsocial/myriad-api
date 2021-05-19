import {BootMixin} from '@loopback/boot';
import {ApplicationConfig, createBindingFromClass} from '@loopback/core';
import {CronComponent} from '@loopback/cron';
import {RepositoryMixin, SchemaMigrationOptions} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {
  RestExplorerBindings,
  RestExplorerComponent
} from '@loopback/rest-explorer';
import {ServiceMixin} from '@loopback/service-proxy';
import {Keyring} from '@polkadot/api';
import {mnemonicGenerate} from '@polkadot/util-crypto';
import path from 'path';
import {
  AssetRepository,
  CommentRepository,
  ConversationRepository,
  ExperienceRepository,
  LikeRepository,
  PeopleRepository,
  PostRepository,
  PublicMetricRepository,
  QueueRepository,
  SavedExperienceRepository,
  TagRepository,
  TransactionRepository,
  UserCredentialRepository,
  UserRepository,
  FriendRepository
} from './repositories';
import people from './seed-data/people.json';
import posts from './seed-data/posts.json';
import tags from './seed-data/tags.json';
import users from './seed-data/users.json';
import {MySequence} from './sequence';
import {
  FetchContentRedditJob, 
  FetchContentTwitterJob,
  FetchContentSocialMediaJob, 
  UpdatePostsJob
} from './jobs'
import { KeypairType } from '@polkadot/util-crypto/types';

interface PlatformUser {
  username: string,
  platform_account_id?: string
}

interface Post {
  tags?: string[],
  platformUser: PlatformUser,
  platform?: string,
  text?: string,
  textId?: string,
  hasMedia?: boolean,
  link?: string,
  createdAt?: string,
  peopleId?: string,
  platformCreatedAt?: string
}

export {ApplicationConfig};

export class MyriadApiApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    // Set up the custom sequence
    this.sequence(MySequence);

    // Set up default home page
    this.static('/', path.join(__dirname, '../public'));

    // Customize @loopback/rest-explorer configuration here
    this.configure(RestExplorerBindings.COMPONENT).to({
      path: '/explorer',
    });
    this.component(RestExplorerComponent);

    // Add cron component
    this.component(CronComponent);
    this.add(createBindingFromClass(FetchContentSocialMediaJob))
    // this.add(createBindingFromClass(FetchContentTwitterJob))
    // this.add(createBindingFromClass(FetchContentRedditJob))
    // this.add(createBindingFromClass(UpdatePostsJob))

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
    await super.migrateSchema(options)

    const tagRepo = await this.getRepository(TagRepository)
    const postsRepo = await this.getRepository(PostRepository)
    const peopleRepo = await this.getRepository(PeopleRepository)
    const transactionRepo = await this.getRepository(TransactionRepository)
    const userRepo = await this.getRepository(UserRepository)
    const savedExperienceRepo = await this.getRepository(SavedExperienceRepository)
    const experienceRepo = await this.getRepository(ExperienceRepository)
    const userCredRepo = await this.getRepository(UserCredentialRepository)
    const commentRepo = await this.getRepository(CommentRepository)
    const publicMetricRepo = await this.getRepository(PublicMetricRepository)
    const assetRepository = await this.getRepository(AssetRepository)
    const likeRepository = await this.getRepository(LikeRepository)
    const conversationRepository = await this.getRepository(ConversationRepository)
    const queueRepository = await this.getRepository(QueueRepository)
    const friendRepository = await this.getRepository(FriendRepository)

    await likeRepository.deleteAll()
    await conversationRepository.deleteAll()
    // await queueRepository.deleteAll()
    await assetRepository.deleteAll()
    await tagRepo.deleteAll()
    await postsRepo.deleteAll()
    await peopleRepo.deleteAll()
    await transactionRepo.deleteAll()
    await userRepo.deleteAll()
    await savedExperienceRepo.deleteAll()
    await experienceRepo.deleteAll()
    await userCredRepo.deleteAll()
    await commentRepo.deleteAll()
    await publicMetricRepo.deleteAll()
    await friendRepository.deleteAll()

    const keyring = new Keyring({
      type: process.env.POLKADOT_CRYPTO_TYPE as KeypairType, 
      ss58Format: Number(process.env.POLKADOT_KEYRING_PREFIX)
    });

    const updateUsers = users.map((user:any) => {
      const seed = mnemonicGenerate()
      const pair = keyring.createFromUri(seed + '', user)

      return {
        ...user,
        id: pair.address,
        bio: `Hello, my name is ${user.name}`,
        example: seed,
        createdAt: new Date().toString(),
        updatedAt: new Date().toString()
      }
    })
    const newTags = await tagRepo.createAll(tags)
    const newPeople = await peopleRepo.createAll(people)
    const newUser = await userRepo.createAll(updateUsers)

    for (let i = 0; i < newPeople.length; i++) {
      const person = newPeople[i]
      const personAccountId = person.platform_account_id
      const personUsername = person.username
      const personPlatform = person.platform

      for (let j = 0; j < posts.length; j++) {
        const post: Post = posts[j]
        const postAccountId = post.platformUser.platform_account_id
        const postAccountUsername = post.platformUser.username

        post.createdAt = new Date().toString()

        if (personPlatform === 'twitter') {
          if (personAccountId === postAccountId) {
            post.peopleId = person.id
          }
        }

        if (personPlatform === 'reddit') {
          if (personAccountId === postAccountId) {
            post.peopleId = person.id
          }
        }

        if (personPlatform === 'facebook') {
          if (personUsername === postAccountUsername) {
            post.peopleId = person.id
            post.platformCreatedAt = new Date().toString() 
          }
        }
      }
    }

    for (let i = 0; i < posts.length; i++) {
      const post = await postsRepo.create(posts[i])
      const newKey = keyring.addFromUri('//' + post.id)
      
      await postsRepo.updateById(post.id, {
        walletAddress: newKey.address,
        importBy: [
          ...post.importBy,
          ...newUser.map(user => user.id)
        ]
      })
      
      await publicMetricRepo.create({
        liked: 0,
        comment: 0,
        disliked: 0,
        postId: post.id
      })
    }

    // users.forEach(async user => {
    //   const seed = mnemonicGenerate()
    //   const pair = keyring.createFromUri(seed + '', user)

    //   await userRepo.create({
    //     ...user,
    //     id: pair.address,
    //     bio: `Hello, my name is ${user.name}`,
    //     createdAt: new Date().toString(),
    //     updatedAt: new Date().toString()
    //   })
  
      // await userRepo.savedExperiences(newUser.id).create({
      //   name: newUser.name + " Experience",
      //   tags: [
      //     {
      //       id: 'cryptocurrency',
      //       hide: false
      //     },
      //     {
      //       id: 'blockchain',
      //       hide: false
      //     },
      //     {
      //       id: 'technology',
      //       hide: false
      //     }
      //   ],
      //   people: [
      //     {
      //       username: "gavofyork",
      //       platform_account_id: "33962758",
      //       platform: "twitter",
      //       profile_image_url: "https://pbs.twimg.com/profile_images/981390758870683656/RxA_8cyN_400x400.jpg",
      //       hide: false
      //     },
      //     {
      //       username: "CryptoChief",
      //       platform_account_id: "t2_e0t5q",
      //       platform: "reddit",
      //       profile_image_url: "https://www.redditstatic.com/avatars/avatar_default_15_DB0064.png",
      //       hide: false
      //     }
      //   ],
      //   description: `Hello, ${newUser.name}! Welcome to myriad!`,
      //   userId: newUser.id,
      //   createdAt: new Date().toString(),
      //   updatedAt: new Date().toString()
      // })
    // })
  }
}

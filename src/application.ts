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
import {KeypairType} from '@polkadot/util-crypto/types';
import * as firebaseAdmin from 'firebase-admin';
import path from 'path';
import {
  FetchContentRedditJob,
  FetchContentSocialMediaJob,
  FetchContentTwitterJob,
  UpdatePostsJob
} from './jobs';
import {
  AssetRepository,
  CommentRepository,
  ConversationRepository,
  ExperienceRepository,
  FriendRepository,
  LikeRepository,
  PeopleRepository,
  PostRepository,
  PublicMetricRepository,
  SavedExperienceRepository,
  TagRepository,
  TransactionRepository,
  UserCredentialRepository,
  UserRepository
} from './repositories';
import people from './seed-data/people.json';
import posts from './seed-data/posts.json';
import {MySequence} from './sequence';

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
    this.add(createBindingFromClass(FetchContentTwitterJob))
    this.add(createBindingFromClass(FetchContentRedditJob))
    this.add(createBindingFromClass(UpdatePostsJob))

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

    // initialize firebase app
    const fApp = firebaseAdmin.initializeApp();
    console.log(fApp.options)
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
    const friendRepository = await this.getRepository(FriendRepository)

    await likeRepository.deleteAll()
    await conversationRepository.deleteAll()
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

    const newPeople = await peopleRepo.createAll(people)

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
      })

      await publicMetricRepo.create({
        liked: 0,
        comment: 0,
        disliked: 0,
        postId: post.id
      })
    }
  }
}

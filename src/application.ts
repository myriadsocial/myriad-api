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
import {u8aToHex} from '@polkadot/util';
import {mnemonicGenerate, encodeAddress} from '@polkadot/util-crypto';
import {KeypairType} from '@polkadot/util-crypto/types';
import { polkadotApi } from './helpers/polkadotApi';
import dotenv from 'dotenv';
import * as firebaseAdmin from 'firebase-admin';
import path from 'path';
import {
  FetchContentSocialMediaJob, RemovedContentJob
} from './jobs';
import {
  CommentRepository,
  ConversationRepository,
  DetailTransactionRepository,
  ExperienceRepository,
  FriendRepository,
  LikeRepository,
  PeopleRepository,
  PostRepository,
  PublicMetricRepository,
  QueueRepository,
  SavedExperienceRepository,
  TagRepository,
  TokenRepository,
  TransactionRepository,
  UserCredentialRepository,
  UserRepository,
  UserTokenRepository,
  AuthenticationRepository,
  AuthCredentialRepository,
  RefreshTokenRepository
} from './repositories';
import people from './seed-data/people.json';
import posts from './seed-data/posts.json';
import tokens from './seed-data/tokens.json';
import users from './seed-data/users.json';
import {MySequence} from './sequence';
import {NotificationService} from './services';
import {Post} from './interfaces'

import {AuthenticationComponent} from '@loopback/authentication';
import {JWTAuthenticationComponent} from './jwt-authentication-component'

dotenv.config()

export {ApplicationConfig};

export class MyriadApiApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    this.component(AuthenticationComponent);
    // Mount jwt component
    this.component(JWTAuthenticationComponent);

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
    this.add(createBindingFromClass(RemovedContentJob))
    // Optional:
    // this.add(createBindingFromClass(FetchContentTwitterJob))
    // this.add(createBindingFromClass(FetchContentRedditJob))
    // this.add(createBindingFromClass(UpdatePostsJob))

    // Add services
    this.service(NotificationService)

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
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert({
        projectId: (process.env.FIREBASE_PROJECT_ID ?? ""),
        clientEmail: (process.env.FIREBASE_CLIENT_EMAIL ?? ""),
        privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, '\n'),
      }),
    })
  }

  async migrateSchema(options?: SchemaMigrationOptions) {
    await super.migrateSchema(options)

    const {
      userRepository, 
      tokenRepository, 
      userTokenRepository, 
      peopleRepository,
      tagRepository,
      postRepository,
      publicMetricRepository
    } = await this.getAllRepository();

    const updatedUsers = this.updateUsers(users);
    const updatedTokens = tokens;

    const newToken = await tokenRepository.createAll(updatedTokens)
    const newUsers = await userRepository.createAll(updatedUsers)
    const newPeople = await peopleRepository.createAll(people)

    const updatedPost = this.updatePost(newPeople, posts);

    for (let i = 0; i < newUsers.length; i++) {
      await userTokenRepository.create({
        userId: newUsers[i].id,
        tokenId: "MYR"
      })
    }

    for (let i = 0; i < updatedPost.length; i++) {
      const {tags} = updatedPost[i]
      const post: any = updatedPost[i]
      const newKey = this.createKeyring().addFromUri('//' + post.peopleId)

      post.walletAddress = u8aToHex(newKey.publicKey);

      const newPost = await postRepository.create(post);

      await publicMetricRepository.create({
        liked: 0,
        comment: 0,
        disliked: 0,
        postId: newPost.id
      })

      for (let j = 0; j < tags.length; j++) {
        const foundTag = await tagRepository.findOne({
          where: {
            or: [
              {
                id: tags[j]
              },
              {
                id: tags[j].toLowerCase()
              },
              {
                id: tags[j].toUpperCase()
              }
            ],
          }
        })

        if (!foundTag) {
          await tagRepository.create({
            id: tags[j],
            count: 1,
            createdAt: new Date().toString(),
            updatedAt: new Date().toString()
          })
        } else {
          const oneDay: number = 60 * 60 * 24 * 1000;
          const isOneDay: boolean = new Date().getTime()
            - new Date(foundTag.updatedAt).getTime()
            > oneDay;

          await tagRepository.updateById(foundTag.id, {
            updatedAt: new Date().toString(),
            count: isOneDay ? 1 : foundTag.count + 1
          })
        }
      }
    }
  }

  async getAllRepository() {
    const tagRepository = await this.getRepository(TagRepository)
    const postRepository = await this.getRepository(PostRepository)
    const peopleRepository = await this.getRepository(PeopleRepository)
    const transactionRepository = await this.getRepository(TransactionRepository)
    const userRepository = await this.getRepository(UserRepository)
    const savedExperienceRepository = await this.getRepository(SavedExperienceRepository)
    const experienceRepository = await this.getRepository(ExperienceRepository)
    const userCredRepository = await this.getRepository(UserCredentialRepository)
    const commentRepository = await this.getRepository(CommentRepository)
    const publicMetricRepository = await this.getRepository(PublicMetricRepository)
    const likeRepository = await this.getRepository(LikeRepository)
    const conversationRepository = await this.getRepository(ConversationRepository)
    const friendRepository = await this.getRepository(FriendRepository)
    const tokenRepository = await this.getRepository(TokenRepository)
    const detailTransactionRepository = await this.getRepository(DetailTransactionRepository)
    const userTokenRepository = await this.getRepository(UserTokenRepository)
    const queueRepository = await this.getRepository(QueueRepository)
    const authenticationRepository = await this.getRepository(AuthenticationRepository)
    const authCredentialRepository = await this.getRepository(AuthCredentialRepository)
    const refreshTokenRepository = await this.getRepository(RefreshTokenRepository)

    await likeRepository.deleteAll()
    await conversationRepository.deleteAll()
    await tagRepository.deleteAll()
    await postRepository.deleteAll()
    await peopleRepository.deleteAll()
    await transactionRepository.deleteAll()
    await userRepository.deleteAll()
    await savedExperienceRepository.deleteAll()
    await experienceRepository.deleteAll()
    await userCredRepository.deleteAll()
    await commentRepository.deleteAll()
    await publicMetricRepository.deleteAll()
    await friendRepository.deleteAll()
    await tokenRepository.deleteAll()
    await userTokenRepository.deleteAll()
    await detailTransactionRepository.deleteAll()
    await queueRepository.deleteAll()
    await authenticationRepository.deleteAll()
    await authCredentialRepository.deleteAll()
    await refreshTokenRepository.deleteAll()

    return {
      tokenRepository,
      userRepository,
      userTokenRepository,
      peopleRepository,
      postRepository,
      publicMetricRepository,
      tagRepository
    }
  }

  updateUsers(users: object[]) {
    const updatedUsers = users.map((user: any) => {
      const seed = mnemonicGenerate()
      const pair = this.createKeyring().createFromUri(seed + '', user)
      const name = user.name

      return {
        ...user,
        username: name.toLowerCase(),
        id: u8aToHex(pair.publicKey),
        seed_example: seed,
        bio: `Hello, my name is ${name}`,
        createdAt: new Date().toString(),
        updatedAt: new Date().toString()
      }
    })

    return updatedUsers
  }

  updatePost(people:any[], posts: any[]) {
    for (let i = 0; i < people.length; i++) {
      const person = people[i]
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

    return posts
  }

  createKeyring() {
    return new Keyring({
      type: process.env.MYRIAD_CRYPTO_TYPE as KeypairType
    });
  }
}

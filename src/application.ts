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
  UserTokenRepository
} from './repositories';
import people from './seed-data/people.json';
import posts from './seed-data/posts.json';
import tokens from './seed-data/tokens.json';
import users from './seed-data/users.json';
import {MySequence} from './sequence';
import {NotificationService} from './services';
import {Post} from './interfaces'

dotenv.config()

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
    const likeRepository = await this.getRepository(LikeRepository)
    const conversationRepository = await this.getRepository(ConversationRepository)
    const friendRepository = await this.getRepository(FriendRepository)
    const tokenRepository = await this.getRepository(TokenRepository)
    const detailTransactionRepository = await this.getRepository(DetailTransactionRepository)
    const userTokenRepository = await this.getRepository(UserTokenRepository)
    const queueRepository = await this.getRepository(QueueRepository)

    await likeRepository.deleteAll()
    await conversationRepository.deleteAll()
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
    await tokenRepository.deleteAll()
    await userTokenRepository.deleteAll()
    await detailTransactionRepository.deleteAll()
    await queueRepository.deleteAll()

    const keyring = new Keyring({
      type: process.env.MYRIAD_CRYPTO_TYPE as KeypairType
    });

    const updateUsers = users.map((user: any) => {
      const seed = mnemonicGenerate()
      const pair = keyring.createFromUri(seed + '', user)
      const name = user.name

      delete user.name
      delete user.username

      return {
        ...user,
        id: u8aToHex(pair.publicKey),
        seed_example: seed,
        bio: `Hello, my name is ${name}`,
        createdAt: new Date().toString(),
        updatedAt: new Date().toString()
      }
    })

    const newToken = await tokenRepository.createAll(tokens)
    // const newUser = await userRepo.createAll(updateUsers)

    const api = await polkadotApi(process.env.MYRIAD_WS_RPC || "") 

    for (let i = 0; i < updateUsers.length; i++) {
      const mnemonic = process.env.MYRIAD_FAUCET_MNEMONIC ?? "";
      const from = keyring.addFromMnemonic(mnemonic);
      const value = +(process.env.MYRIAD_ACCOUNT_DEPOSIT ?? 100000000000000);
      const myriadPrefix = Number(process.env.MYRIAD_ADDRESS_PREFIX);
      const {nonce} = await api.query.system.account(encodeAddress(from.address, myriadPrefix))

      let count: number = nonce.toJSON()

      const transfer = api.tx.balances.transfer(encodeAddress(updateUsers[i].id, myriadPrefix), value)

      const newUser = await userRepo.create(updateUsers[i])
      const txHash = await transfer.signAndSend(from, {nonce: count + i});

      await transactionRepo.create({
        trxHash: txHash.toString(),
        from: u8aToHex(from.publicKey),
        to: updateUsers[i].id,
        value: value,
        state: 'success',
        createdAt: new Date().toString(),
        tokenId: 'MYR',
        hasSendToUser: true
      })

      await userTokenRepository.create({
        userId: newUser.id,
        tokenId: "MYR"
      })

      await detailTransactionRepository.create({
        sentToMe: 100000000000000,
        sentToThem: 0,
        userId: newUser.id,
        tokenId: 'MYR'
      })
    }

    await api.disconnect()

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
      const {tags} = posts[i]
      const post: any = posts[i]
      const newKey = keyring.addFromUri('//' + post.peopleId)

      post.walletAddress = u8aToHex(newKey.publicKey);

      const newPost = await postsRepo.create(post);

      await publicMetricRepo.create({
        liked: 0,
        comment: 0,
        disliked: 0,
        postId: newPost.id
      })

      for (let j = 0; j < tags.length; j++) {
        const foundTag = await tagRepo.findOne({
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
          await tagRepo.create({
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

          await tagRepo.updateById(foundTag.id, {
            updatedAt: new Date().toString(),
            count: isOneDay ? 1 : foundTag.count + 1
          })
        }
      }
    }
  }
}

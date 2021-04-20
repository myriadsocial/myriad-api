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
  CommentRepository,
  ExperienceRepository,
  PeopleRepository,
  PostRepository,
  SavedExperienceRepository,
  TagRepository,
  UserCredentialRepository, UserRepository,
  TransactionRepository
} from './repositories';
import comments from './seed-data/comments.json';
import people from './seed-data/people.json';
import posts from './seed-data/posts.json';
import tags from './seed-data/tags.json';
import users from './seed-data/users.json';
import {polkadotApi} from './helpers/polkadotApi'
import {MySequence} from './sequence';
import {
  FetchContentFacebookJob,
  FetchContentRedditJob, 
  FetchContentTwitterJob,
  UpdatePostsJob
} from './jobs'

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
  peopleId?: string
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
    this.add(createBindingFromClass(FetchContentFacebookJob))
    this.add(createBindingFromClass(FetchContentTwitterJob))
    this.add(createBindingFromClass(FetchContentRedditJob))
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

    const userRepo = await this.getRepository(UserRepository)
    const tagRepo = await this.getRepository(TagRepository)
    const experienceRepo = await this.getRepository(ExperienceRepository)
    const savedExperiencesRepo = await this.getRepository(SavedExperienceRepository)
    const postsRepo = await this.getRepository(PostRepository)
    const peopleRepo = await this.getRepository(PeopleRepository)
    const commentsRepo = await this.getRepository(CommentRepository)
    const userCredRepo = await this.getRepository(UserCredentialRepository)
    const transactionRepo = await this.getRepository(TransactionRepository)

    await userRepo.deleteAll()
    await tagRepo.deleteAll()
    await experienceRepo.deleteAll()
    await savedExperiencesRepo.deleteAll()
    await postsRepo.deleteAll()
    await peopleRepo.deleteAll()
    await commentsRepo.deleteAll()
    await userCredRepo.deleteAll()
    await transactionRepo.deleteAll()
    
    // const api = await polkadotApi()
    const keyring = new Keyring({type: 'sr25519', ss58Format: 214});
    // const mnemonic = 'chalk cargo recipe ring loud deputy element hole moral soon lock credit';
    // const from = keyring.addFromMnemonic(mnemonic);
    // const value = 100000000000000;

    const newTags = await tagRepo.createAll(tags)
    const newPeople = await peopleRepo.createAll(people)

    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      const seed = mnemonicGenerate()
      const newKey = keyring.createFromUri(seed + "", {name: user.name})
      const newUser = await userRepo.create({
        ...user,
        id: newKey.address
      })

      // const {nonce} = await api.query.system.account(newUser.id)
      // console.log(nonce)
      // const nonce = await api.rpc.system.accountNextIndex(from);
      // const to = newUser.id;
      // const transfer = api.tx.balances.transfer(to, value);
      
      // await transfer.signAndSend(from, {nonce: -1});

      await userRepo.savedExperiences(newUser.id).create({
        name: newUser.name[0].toUpperCase() + newUser.name.substr(1) + " Experience",
        createdAt: new Date().toString(),
        userId: newUser.id,
        tags: [{
          id: 'myriad',
          hide: false
        }],
        people: [{
          username: "NetworkMyriad",
          platform_account_id: "1382543232882462720",
          hide: false
        }],
        description: `Hello, ${newUser.name[0].toUpperCase() + newUser.name.substr(1)}! Welcome to myriad!`
      })
    }

    for (let i = 0; i < newPeople.length; i++) {
      const person = newPeople[i]
      const personAccountId = person.platform_account_id
      const personUsername = person.username
      const personPlatform = person.platform

      for (let j = 0; j < posts.length; j++) {
        const post: Post = posts[j]
        const postAccountId = post.platformUser.platform_account_id
        const postAccountUsername = post.platformUser.username

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
          }
        }
      }
    }

    for (let i = 0; i < posts.length; i++) {
      const post = await postsRepo.create(posts[i])
      const newKey = keyring.addFromUri('//' + post.id)

      await postsRepo.updateById(post.id, {walletAddress: newKey.address})
    }

    const newPosts = await postsRepo.find()
    const newUsers = await userRepo.find()

    await commentsRepo.createAll(comments.map(function (comment, index) {
      if (index % 2 === 0) {
        return {
          ...comment,
          userId: newUsers[0].id,
          postId: newPosts[1].id
        }
      } else {
        return {
          ...comment,
          userId: newUsers[1].id,
          postId: newPosts[1].id
        }
      }
    }))
  }
}

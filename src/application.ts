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
import path from 'path';
import {FetchContentRedditJob} from './jobs/fetchContentReddit.job';
// import {FetchContentJob} from './jobs/fetchcontent.job';
import {FetchContentTwitterJob} from './jobs/fetchContentTwitter.job';
import {CommentRepository, ExperienceRepository, PeopleRepository, PostRepository, SavedExperienceRepository, TagRepository, UserRepository} from './repositories';
import comments from './seed-data/comments.json';
import experiences from './seed-data/experiences.json';
import people from './seed-data/people.json';
import posts from './seed-data/posts.json';
import tags from './seed-data/tags.json';
import users from './seed-data/users.json';
import {MySequence} from './sequence';

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
    // this.add(createBindingFromClass(FetchContentTwitterJob))
    // this.add(createBindingFromClass(FetchContentRedditJob))
    // this.add(createBindingFromClass(FetchContentJob));

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

    await userRepo.deleteAll()
    await tagRepo.deleteAll()
    await experienceRepo.deleteAll()
    await savedExperiencesRepo.deleteAll()
    await postsRepo.deleteAll()
    await peopleRepo.deleteAll()
    await commentsRepo.deleteAll()

    const newTags = await tagRepo.createAll(tags)
    const newUsers = await userRepo.createAll(users)
    const newPeople = await peopleRepo.createAll(people)
    const redditPosts = posts.filter(post => post.platformUser.username.startsWith('u/'))
    const twitterPosts = posts.filter(post => !post.platformUser.username.startsWith('u/'))

    // console.log(redditPosts)

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

    for (let i = 0; i < newPeople.length; i++) {
      const person = newPeople[i]
      const personAccountId = person.platform_account_id
      const personUsername = person.username
      const personPlatform = person.platform

      for (let j = 0; j < posts.length; j++) {
        const post:Post = posts[j]
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

    const experience1 = await userRepo.savedExperiences(newUsers[0].id).create({
      ...experiences[0],
      userId: newUsers[0].id
    })
    const experience2 = await userRepo.savedExperiences(newUsers[1].id).create({
      ...experiences[1],
      userId: newUsers[1].id
    })

    await savedExperiencesRepo.create({
      user_id: newUsers[1].id,
      experience_id: experience2.id
    })

    const newPosts = await postsRepo.createAll(posts)
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

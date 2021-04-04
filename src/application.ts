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
// import {FetchContentJob} from './jobs/fetchcontent.job';
import {FetchContentTwitterJob} from './jobs/fetchContentTwitter.job'
import { CommentRepository, ExperienceRepository, PeopleRepository, PostRepository, SavedExperienceRepository, TagRepository, UserRepository } from './repositories';
import {MySequence} from './sequence';
import users from './seed-data/users.json'
import tags from './seed-data/tags.json'
import experiences from './seed-data/experiences.json'
import posts from './seed-data/posts.json'
import people from './seed-data/people.json'
import comments from './seed-data/comments.json'

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
    this.add(createBindingFromClass(FetchContentTwitterJob))
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
    const newPosts = await postsRepo.createAll(posts)
    const newPeople = await peopleRepo.createAll(people)

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

    await commentsRepo.createAll(comments.map(function(comment, index){
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

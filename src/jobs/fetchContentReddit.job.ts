import {inject} from '@loopback/core'
import {cronJob, CronJob} from '@loopback/cron'
import {repository} from '@loopback/repository'
import {PeopleRepository, PostRepository, TagRepository} from '../repositories'
import {Reddit} from '../services'

@cronJob()
export class FetchContentRedditJob extends CronJob {
  constructor(
    @inject('services.Reddit') protected redditService: Reddit,
    @repository(PostRepository) public postRepository: PostRepository,
    @repository(PeopleRepository) public peopleRepository: PeopleRepository,
    @repository(TagRepository) public tagRepository: TagRepository

  ) {
    super({
      name: 'fetch-content-reddit-job',
      onTick: async () => {
        await this.performJob();
      },
      cronTime: '*/1800 * * * * *',
      start: true
    })
  }

  async performJob() {
    await this.searchPostByTag()
    await this.searchPostByPeople()
  }

  async searchPostByPeople() {
    try {
      const people = await this.peopleRepository.find({where: {platform: "reddit"}})

      for (let i = 0; i < people.length; i++) {
        const person = people[i]
        const {data: user} = await this.redditService.getActions(`u/${person.username}.json`)

        const posts = user.children.filter((post: any) => {
          return post.kind === 't3'
        })

        for (let j = 0; j < posts.length; j++) {
          const post = posts[j].data

          const foundPost = await this.postRepository.findOne({where: {textId: post.id}})

          if (foundPost) continue

          await this.postRepository.create({
            platformUser: {
              username: post.author,
              platform_account_id: post.author_fullname
            },
            tags: [],
            platform: 'reddit',
            peopleId: person.id,
            title: post.title,
            text: post.selftext,
            textId: post.id,
            hasMedia: post.media_metadata || post.is_reddit_media_domain ? true : false,
            link: `https://wwww.reddit.com${post.id}`,
            createdAt: new Date().toString()
          })
        }
      }
    } catch (err) { }
  }

  async searchPostByTag() {
    try {
      const tags = await this.tagRepository.find()

      for (let i = 0; i < tags.length; i++) {

        const tag = tags[i]
        const {data} = await this.redditService.getActions(`search.json?q=${tag.id}&sort=new&limit=20`)

        if (data.children.length === 0) continue

        const posts = data.children.filter((post: any) => {
          return post.kind === 't3'
        })

        for (let j = 0; j < posts.length; j++) {
          const post = posts[j].data
          const foundPost = await this.postRepository.findOne({where: {textId: post.id}})

          if (foundPost) continue

          const foundPerson = await this.peopleRepository.findOne({where: {username: `u/${post.author}`}})

          if (foundPerson) {
            await this.postRepository.create({
              platformUser: {
                username: `u/${post.author}`
              },
              tags: [tag.id],
              platform: 'reddit',
              peopleId: foundPerson.id,
              title: post.title,
              text: post.selftext,
              textId: post.id,
              hasMedia: post.media_metadata || post.is_reddit_media_domain ? true : false,
              link: `https://wwww.reddit.com${post.permalink}`,
              createdAt: new Date().toString()
            })
          } else {
            await this.postRepository.create({
              platformUser: {
                username: `u/${post.author}`
              },
              tags: [tag.id],
              platform: 'reddit',
              title: post.title,
              text: post.selftext,
              textId: post.id,
              hasMedia: post.media_metadata || post.is_reddit_media_domain ? true : false,
              link: `https://wwww.reddit.com${post.permalink}`,
              createdAt: new Date().toString()
            })
          }
        }
      }
    } catch (err) { }
  }
}

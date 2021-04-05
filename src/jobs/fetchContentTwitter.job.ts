import {inject} from '@loopback/core'
import {CronJob, cronJob} from '@loopback/cron'
import {repository} from '@loopback/repository'
import {PostRepository, PeopleRepository, TagRepository} from '../repositories'
import {Twitter} from '../services'

@cronJob()

export class FetchContentTwitterJob extends CronJob {
  constructor(
    @inject('services.Twitter') protected twitterService:Twitter,
    @repository(PostRepository) public postRepository:PostRepository,
    @repository(PeopleRepository) public peopleRepository:PeopleRepository,
    @repository(TagRepository) public tagRepository:TagRepository,
  ) {
    super({
      name: 'fetch-content-twitter-job',
      onTick: async () => {
        await this.performJob();
      },
      cronTime: '*/1800 * * * * *',
      start: true
    })
  }

  async performJob () {
    const people = await this.peopleRepository.find()
    const posts = await this.postRepository.find()

    for (let i = 0; i < people.length; i++) {
      const person = people[i]
      const personPosts = posts.filter(post => {
        if (post.people) {
          return post.people.platform_account_id === person.platform_account_id
        }

        return false
      })

      let maxId = ''
      for (let j = 0; j < personPosts.length; j++) {
        const id = personPosts[j].textId

        if (id > maxId) {
          maxId = id
        }
      }

      const {data: newPosts} = await this.twitterService.getActions(`users/${person.platform_account_id}/tweets?max_results=15&since_id=${maxId}&tweet.fields=attachments,entities,referenced_tweets`)
      const filterNewPost = newPosts.filter((post: any) => !post.referenced_tweets)

      if (filterNewPost.length > 0) {
        for (let k = 0; k < filterNewPost.length; k++) {
          const post = filterNewPost[k]
          const tags = post.entities ? post.entities.hashtags ? post.entities.hashtags.map((hashtag: any) => hashtag.tag) : [] : []

          const people = {
            username: person.username,
            platform_account_id: person.platform_account_id
          }

          const hasMedia = post.attachments ? Boolean(post.attachments.mediaKeys) : false
          const platform = 'twitter'
          const text = post.text
          const textId = post.id
          const link = `https://twitter.com/${person.username}/status/${textId}`

          for (let l = 0; l < tags.length; l++) {
            const tag = tags[i]
            const [findTag] = await this.tagRepository.find({ where: { id: tag.toLowerCase() } })

            if (!findTag) {
              await this.tagRepository.create({
                id: tag.toLowerCase(),
                createdAt: new Date().toString()
              })
            }
          }

          await this.postRepository.create({
            textId, text, tags, people, hasMedia, platform, link, createdAt: new Date().toString()
          })
        }
      }
    }
  }
}
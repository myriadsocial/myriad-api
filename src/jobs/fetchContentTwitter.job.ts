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
    await this.searchPostByPeople()
    await this.searchPostByTag()
  }

  async searchPostByPeople ():Promise<void> {
    const people = await this.peopleRepository.find({where: {platform: 'twitter'}})
    const posts = await this.postRepository.find({where: {platform: 'twitter'}})

    for (let i = 0; i < people.length; i++) {
      const person = people[i]
      const personPosts = posts.filter(post => {
        if (post.people.platform_account_id) {
          return post.people.platform_account_id === person.platform_account_id
        }
 
        return false
      })

      let maxId = ''
      for (let j = 0; j < personPosts.length; j++) {
        const id = personPosts[j].textId
        // console.log(id)
        if (id > maxId) {
          maxId = id
        }
      }

      if (!maxId) continue

      const { data: newPosts } = await this.twitterService.getActions(`users/${person.platform_account_id}/tweets?since_id=${maxId}&tweet.fields=attachments,entities,referenced_tweets`)

      if (!newPosts) continue
      const filterNewPost = newPosts.filter((post: any) => !post.referenced_tweets)

      if (filterNewPost.length > 0) {
        for (let k = 0; k < filterNewPost.length; k++) {
          const post = filterNewPost[k]
          const [foundPost] = await this.postRepository.find({ where: { textId: post.id, platform: post.platform } })

          if (!foundPost) {
            const tags = post.entities ? post.entities.hashtags ? post.entities.hashtags.map((hashtag: any) => hashtag.tag.toLowerCase()) : [] : []

            const people = {
              username: person.username,
              platform_account_id: person.platform_account_id
            }

            const hasMedia = post.attachments ? Boolean(post.attachments.mediaKeys) : false
            const platform = 'twitter'
            const text = post.text
            const textId = post.id
            const link = `https://twitter.com/${person.username}/status/${textId}`

            await this.postRepository.create({
              textId, text, tags, people, hasMedia, platform, link, createdAt: new Date().toString()
            })
          }
        }
      }
    }
  }

  async searchPostByTag ():Promise<void> {
    const tagsRepo = await this.tagRepository.find()
    const posts = await this.postRepository.find({where: {platform: 'twitter'}})

    for (let i = 0; i < tagsRepo.length; i++) {
      const tag = tagsRepo[i]
      const tagPosts = posts.filter(post => {
        if (post.tags) {
          const foundPost = post.tags.find(e => e === tag.id)

          if (foundPost) return true
        } 

        else false
      })

      let maxId = ''
      for (let i = 0; i < tagPosts.length; i++) {
        const id = tagPosts[i].textId
        
        if (id > maxId) {
          maxId = id
        }
      }
      
      if (!maxId) continue
      
      const {data:newPosts} = await this.twitterService.getActions(`tweets/search/recent?max_results=10&since_id=${maxId}&tweet.fields=referenced_tweets,attachments,entities&expansions=author_id&query=%23${tag.id}`)

      if (!newPosts) continue
      const filterNewPost = newPosts.filter((post:any) => !post.referenced_tweets)

      if (filterNewPost.length > 0) {
        for (let k = 0; k < filterNewPost.length; k++) {
          const post = filterNewPost[k]
          const foundPost = await this.postRepository.findOne({where: {textId: post.id, platform: post.platform}})

          if (!foundPost) {
            const { data: person } = await this.twitterService.getActions(`users/${post.author_id}`)
            const tags = post.entities ? post.entities.hashtags ? post.entities.hashtags.map((hashtag: any) => hashtag.tag.toLowerCase()) : [] : []
            const people = {
              username: person.username,
              platform_account_id: person.id
            }
            const hasMedia = post.attachments ? Boolean(post.attachments.mediaKeys) : false
            const platform = 'twitter'
            const text = post.text
            const textId = post.id
            const link = `https://twitter.com/${person.username}/status/${textId}`

            await this.postRepository.create({
              textId, text, tags, people, hasMedia, platform, link, createdAt: new Date().toString()
            })
          }
        }
      }
    }
  }
}
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
    // await this.updatePostPeople()
  }

  async searchPostByPeople ():Promise<void> {
    try {
      const people = await this.peopleRepository.find({where: {platform: 'twitter'}})
      const posts = await this.postRepository.find({where: {platform: 'twitter'}})
  
      for (let i = 0; i < people.length; i++) {
        const person = people[i]
        const personPosts = posts.filter(post => {
          if (post.platformUser) {
            return post.platformUser.platform_account_id === person.platform_account_id
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
  
        if (!maxId) continue
  
        const { data: newPosts } = await this.twitterService.getActions(`users/${person.platform_account_id}/tweets?since_id=${maxId}&tweet.fields=attachments,entities,referenced_tweets`)
  
        if (!newPosts) continue

        const filterNewPost = newPosts.filter((post: any) => !post.referenced_tweets)

        if (filterNewPost.length === 0) continue
  
        for (let k = 0; k < filterNewPost.length; k++) {
          const post = filterNewPost[k]
          const foundPost = await this.postRepository.findOne({ where: { textId: post.id, platform: 'twitter' } })

          if (foundPost) continue

          const tags = post.entities ? post.entities.hashtags ? post.entities.hashtags.map((hashtag: any) => hashtag.tag.toLowerCase()) : [] : []

          const platformUser = {
            username: person.username,
            platform_account_id: person.platform_account_id
          }

          const hasMedia = post.attachments ? Boolean(post.attachments.media_keys) : false
          const platform = 'twitter'
          const text = post.text
          const textId = post.id
          const link = `https://twitter.com/${person.username}/status/${textId}`
          const peopleId = person.id

          await this.postRepository.create({
            textId, text, tags, platformUser, hasMedia, platform, link, peopleId, createdAt: new Date().toString()
          })
        }
      }
    } catch (err) {
      // console.log(err)
    }
  }

  async searchPostByTag ():Promise<void> {
    try {
      const tagsRepo = await this.tagRepository.find()

      for (let i = 0; i < tagsRepo.length; i++) {
        const tag = tagsRepo[i]
  
        const {data:newPosts, includes} = await this.twitterService.getActions(`tweets/search/recent?max_results=10&tweet.fields=referenced_tweets,attachments,entities&expansions=author_id&user.fields=id,username&query=%23${tag.id}`)
        const {users} = includes
  
        if (!newPosts) continue
  
        const filterNewPost = newPosts.filter((post:any) => !post.referenced_tweets)
  
        if (filterNewPost.length === 0) continue
  
        for (let k = 0; k < filterNewPost.length; k++) {
          const post = filterNewPost[k]
          const foundPost = await this.postRepository.findOne({where: {textId: post.id, platform: 'twitter'}})
          const username = users.find((user:any) => user.id === post.author_id).username
  
          if (!foundPost) {
            const tags = post.entities ? post.entities.hashtags ? post.entities.hashtags.map((hashtag: any) => hashtag.tag.toLowerCase()) : [] : []
            const hasMedia = post.attachments ? Boolean(post.attachments.media_keys) : false
            const platform = 'twitter'
            const text = post.text 
            const textId = post.id
            const link = `https://twitter.com/${username}/status/${textId}`
            const platformUser = {
              username, 
              platform_account_id: post.author_id
            }
  
            const foundPeople = await this.peopleRepository.findOne({where: {platform_account_id: platformUser.platform_account_id}})
  
            if (foundPeople) { 
              const peopleId = foundPeople.id
              await this.postRepository.create({
                textId, text, tags, platformUser, hasMedia, platform, link, peopleId, createdAt: new Date().toString()
              })
            } else {
              await this.postRepository.create({
                textId, text, tags, platformUser, hasMedia, platform, link, createdAt: new Date().toString()
              })
            }
          }
        }
      }  
    } catch (e) {}
  }

  async updatePostPeople ():Promise<void> {
    try {
      const posts = await this.postRepository.find()
      const filterPost = posts.filter(post => !post.platformUser)
      const postTextIds = filterPost.map(post => post.textId).slice(0,10).join(',')
      const {data: tweets, includes} = await this.twitterService.getActions(`tweets?ids=${postTextIds}&expansions=author_id&user.fields=id,username`)
      const {users} = includes
  
      for (let i = 0; i < users.length; i++) {
        const foundPerson = await this.peopleRepository.findOne({where: {platform_account_id: users[i].id}})
        
        if (foundPerson) {
          const platformUser = {
            username: foundPerson.username,
            platform_account_id: foundPerson.platform_account_id
          }
  
          const filterTweets = tweets.filter((tweet:any) => tweet.author_id === users[i].id )
  
          for (let i = 0; i < filterTweets.length; i++) {
            const foundPost = await this.postRepository.findOne({where: {textId: filterTweets[i].id}})
  
            if (foundPost) { 
              await this.postRepository.updateById(foundPost.id, {platformUser})
            }
            
          }
        }
      }
    } catch(e) {
      // console.log('Error')
    }
  }
}
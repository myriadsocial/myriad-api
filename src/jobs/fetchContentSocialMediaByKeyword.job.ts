import {inject} from '@loopback/core'
import {CronJob, cronJob} from '@loopback/cron'
import {repository} from '@loopback/repository'
import {Keyring} from '@polkadot/api'
import {
  PeopleRepository, 
  PostRepository, 
  TagRepository,
  UserCredentialRepository,
  PublicMetricRepository
} from '../repositories'
import {xml2json} from 'xml-js'
import {
  Twitter,
  Reddit,
  Rsshub
} from '../services'

@cronJob()
export class FetchContentSocialMediaByKeywordJob extends CronJob {
  constructor(
    @inject('services.Twitter') protected twitterService: Twitter,
    @inject('services.Reddit') protected redditService: Reddit,
    @inject('services.Rsshub') protected rsshubService: Rsshub,
    @repository(PostRepository) public postRepository: PostRepository,
    @repository(PeopleRepository) public peopleRepository: PeopleRepository,
    @repository(TagRepository) public tagRepository: TagRepository,
    @repository(UserCredentialRepository) public userCredentialRepository: UserCredentialRepository,
    @repository(PublicMetricRepository) public publicMetricRepository: PublicMetricRepository
  ) {
    super({
      name: 'fetch-content-twitter-job',
      onTick: async () => {
        await this.performJob();
      },
      cronTime: '*/3600 * * * * *',
      start: true
    })
  }

  async performJob() {
    try {
      const people = await this.peopleRepository.find()

      for (let i = 0; i < people.length; i++) {
        const person = people[i]
        await this.socialMediaPost(person)
      }
    } catch (err) {}
  }

  async searchPostByTag(): Promise<void> {
    try {
      const tagsRepo = await this.tagRepository.find()

      for (let i = 0; i < tagsRepo.length; i++) {
        const tag = tagsRepo[i]
        const tweetField = 'referenced_tweets,attachments,entities,created_at'
        const {data: newPosts, includes} = await this.twitterService.getActions(`tweets/search/recent?max_results=10&tweet.fields=${tweetField}&expansions=author_id&user.fields=id,username,profile_image_url&query=${tag.id}`)

        if (!newPosts) continue

        const {users} = includes
        const filterNewPost = newPosts.filter((post: any) => !post.referenced_tweets)

        for (let j = 0; j < filterNewPost.length; j++) {
          const post = filterNewPost[j]
          const foundPost = await this.postRepository.findOne({where: {textId: post.id, platform: 'twitter'}})

          if (foundPost) {
            const foundTag = foundPost.tags.find(postTag => postTag.toLowerCase() === tag.id.toLowerCase())

            if (!foundTag) {
              const tags = [...foundPost.tags, tag.id]

              await this.postRepository.updateById(foundPost.id, {tags})
            }

            continue
          }

          const user = users.find((user: any) => user.id === post.author_id)
          const tags = post.entities ? (post.entities.hashtags ? post.entities.hashtags.map((hashtag: any) => hashtag.tag.toLowerCase()) : []) : []
          const hasMedia = post.attachments ? Boolean(post.attachments.media_keys) : false
          const foundPeople = await this.peopleRepository.findOne({where: {platform_account_id: user.id}})
          const newPost = {
            tags: tags.find((tagPost:string) => tagPost.toLowerCase() === tag.id.toLowerCase()) ? tags : [...tags, tag.id],
            hasMedia,
            platform: 'twitter',
            text: post.text,
            textId: post.id,
            link: `https://twitter.com/${user.id}/status/${post.id}`,
            platformUser: {
              username: user.username,
              platform_account_id: user.id,
              profile_image_url: user.profile_image_url
            },
            platformCreatedAt: post.created_at
          }

          if (foundPeople) {
            const userCredential = await this.userCredentialRepository.findOne({
              where: {
                peopleId: foundPeople.id
              }
            })

            if (userCredential) {
              await this.createPostPublicMetric({
                ...newPost,
                peopleId: foundPeople.id,
                walletAddress: userCredential.userId
              }, true)
            }

            await this.createPostPublicMetric({
              ...newPost,
              peopleId: foundPeople.id
            }, false)
          }

          await this.createPostPublicMetric(newPost, false)
        }
      }
    } catch (e) { }
  }

  async socialMediaPost(people:any):Promise<void> {
    switch (people.platform) {
      case "twitter":
        await this.twitterPost(people)
        break
      
      case "reddit":
        await this.redditPost(people)
        break

      case "facebook":
        await this.facebookPost(people)
        break

      default: 
        throw new Error("Platform does not exist")
    }
  }

  async redditPost(person:any):Promise<void> {
    try {
      const {data: user} = await this.redditService.getActions(`u/${person.username}.json?limit=10`)

      const posts = user.filter((post: any) => {
        return post.kind === 't3'
      })
  
      for (let j = 0; j < posts.length; j++) {
        const post = posts[j].data
        const foundPost = await this.postRepository.findOne({where: {textId: post.id, platform: 'reddit'}})
  
        if (foundPost) continue
  
        const newPost = {
          platformUser: {
            username: post.author,
            platform_account_id: post.author_fullname,
            profile_image_url: person.profile_image_url
          },
          tags: [],
          platform: 'reddit',
          peopleId: person.id,
          title: post.title,
          text: post.selftext,
          textId: post.id,
          hasMedia: post.media_metadata || post.is_reddit_media_domain ? true : false,
          link: `https://wwww.reddit.com/${post.id}`,
          platformCreatedAt: new Date(post.created_utc * 1000).toString()
        }
  
        const userCredential = await this.userCredentialRepository.findOne({where: {peopleId: person.id}})
  
        if (userCredential) {
          await this.createPostPublicMetric({
            ...newPost,
            walletAddress: userCredential.userId,
          }, true)
        }
  
        await this.createPostPublicMetric(newPost, false)
      }
    } catch (err) {}
  }

  async twitterPost(person:any):Promise<void> {
    try {
      const posts = await this.postRepository.find({
        order: ['textId DESC'],
        limit: 1,
        where: {
          peopleId: person.id,
          platform: person.platform
        }
      })

      const {data:newPosts} = await this.twitterService.getActions(`users/${person.platform_account_id}/tweets?since_id=${posts[0].textId}&tweet.fields=attachments,entities,referenced_tweets,created_at`)

      if (!newPosts) throw new Error('Error')
  
      const filterNewPost = newPosts.filter((post: any) => !post.referenced_tweets)
  
      for (let j = 0; j < filterNewPost.length; j++) {
        const post = filterNewPost[j]
        const foundPost = await this.postRepository.findOne({where: {textId: post.id, platform: 'twitter'}})
  
        if (foundPost) continue
  
        const userCredential = await this.userCredentialRepository.findOne({where: {peopleId: person.id}})
        const tags = post.entities ? post.entities.hashtags ? post.entities.hashtags.map((hashtag: any) => hashtag.tag.toLowerCase()) : [] : []
        const hasMedia = post.attachments ? Boolean(post.attachments.media_keys) : false
        const newPost = {
          tags,
          hasMedia,
          platform: "twitter",
          text: post.text,
          textId: post.id,
          link: `https://twitter.com/${person.platform_account_id}/status/${post.id}`,
          peopleId: person.id,
          platformUser: {
            username: person.username,
            platform_account_id: person.platform_account_id,
            profile_image_url: person.profile_image_url
          },
          platformCreatedAt: post.created_at,
        }
  
        if (userCredential) {
          await this.createPostPublicMetric({
            ...newPost,
            walletAddress: userCredential.userId
          }, true)
        }
  
        await this.createPostPublicMetric(newPost, false)
      }
    } catch (err) {}
  }

  async facebookPost(person:any):Promise<void> {
    try {
      const xml = await this.rsshubService.getContents(person.platform_account_id)
      const resultJSON = await xml2json(xml, {compact: true, trim: true})
      const response = JSON.parse(resultJSON)
      const posts = response.rss.channel.item
  
      for (let j = 0; j < posts.length; j++) {
        const post = posts[j]
        const link = post.link._text.split('=')
        const platform_account_id = link[2]
        const textId = link[1].substring(0, link[1].length - 3)
  
        const foundPost = await this.postRepository.findOne({where: {textId}})
  
        if (foundPost) continue
  
        const newPost = { 
          platformUser: {
            username: person.username,
            platform_account_id,
          },
          tags: [],
          platform: 'facebook',
          title: "",
          text: "",
          textId,
          peopleId: person.id,
          hasMedia: false,
          link: `https://facebook.com/${platform_account_id}/posts/${textId}`,
        }
  
        const userCredential = await this.userCredentialRepository.findOne({where: {peopleId: person.id}})
  
        if (userCredential) {
          await this.createPostPublicMetric({
            ...newPost,
            walletAddress: userCredential.userId
          }, true)
        }
  
        await this.createPostPublicMetric(newPost, false)
      }
    } catch (err) {}
  }

  async createPostPublicMetric(post: object, credential: boolean): Promise<void> {
    const newPost = await this.postRepository.create(post)
    await this.publicMetricRepository.create({
      liked: 0,
      comment: 0,
      disliked: 0,
      postId: newPost.id
    })

    if (!credential) {
      const keyring = new Keyring({type: 'sr25519', ss58Format: 214});
      const newKey = keyring.addFromUri('//' +  newPost.id)
  
      await this.postRepository.updateById(newPost.id, {walletAddress: newKey.address})
    }
  }
}

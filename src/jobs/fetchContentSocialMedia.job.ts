import {inject} from '@loopback/core'
import {CronJob, cronJob} from '@loopback/cron'
import {repository} from '@loopback/repository'
import {Keyring} from '@polkadot/api'
import {xml2json} from 'xml-js'
import {
  PeopleRepository,
  PostRepository,


  PublicMetricRepository, TagRepository,
  UserCredentialRepository
} from '../repositories'
import {
  Reddit,
  Rsshub, Twitter
} from '../services'

@cronJob()
export class FetchContentSocialMediaJob extends CronJob {
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
      cronTime: '0 0 */1 * * *', // Every hour
      start: true
    })
  }

  async performJob() {
    const people = await this.peopleRepository.find()

    for (let i = 0; i < people.length; i++) {
      const person = people[i]

      try {
        switch (person.platform) {
          case "twitter":
            const foundPosts = await this.postRepository.find({
              order: ['textId DESC'],
              limit: 1,
              where: {
                peopleId: person.id,
                platform: person.platform
              }
            })

            const {data: newPosts} = await this.twitterService.getActions(`users/${person.platform_account_id}/tweets?since_id=${foundPosts[0].textId}&tweet.fields=attachments,entities,referenced_tweets,created_at`)

            if (!newPosts) break

            const twitterPosts = newPosts.filter((post: any) => !post.referenced_tweets)

            await this.socialMediaPosts(person, twitterPosts)

            break

          case "reddit":
            const {data: user} = await this.redditService.getActions(`u/${person.username}.json?limit=10`)
            const redditPosts = user.children.filter((post: any) => {
              return post.kind === 't3'
            }).map((post: any) => post.data)

            await this.socialMediaPosts(person, redditPosts)
            break

          case "facebook":
            const xml = await this.rsshubService.getContents(person.platform_account_id)
            const resultJSON = await xml2json(xml, {compact: true, trim: true})
            const responseFB = JSON.parse(resultJSON)

            const facebookPost = responseFB.rss.channel.item
            await this.socialMediaPosts(person, facebookPost)
            break

          default:
            throw new Error("Platform does not exist")
        }
      } catch (err) {}
    }
  }

  async socialMediaPosts(person: any, posts: any) {
    try {
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i]
        const foundPost = await this.postRepository.findOne({
          where: {
            textId: person.platform === "facebook" ? this.getFBTextId(post) : post.id,
            platform: person.platform
          }
        })

        if (foundPost) continue

        const userCredential = await this.userCredentialRepository.findOne({where: {peopleId: person.id}})

        const tags = post.entities ? (
          post.entities.hashtags ? post.entities.hashtags.map((hashtag: any) => hashtag.tag.toLowerCase()) : []
        ) : []

        const hasMedia = post.attachments ? Boolean(post.attachments.media_keys) : (
          post.media_metadata || post.is_reddit_media_domain ? true : false
        )

        let newPost = null

        newPost = {
          tags, hasMedia,
          platform: person.platform,
          textId: post.id,
          peopleId: person.id,
          createdAt: new Date().toString(),
          platformUser: {
            username: person.username,
            platform_account_id: person.platform_account_id,
            profile_image_url: person.profile_image_url
          }
        }

        switch (person.platform) {
          case "twitter":
            newPost = {
              ...newPost,
              text: post.text,
              link: `https://twitter.com/${person.platform_account_id}/status/${post.id}`,
              platformCreatedAt: post.created_at,
            }

            break

          case "reddit":
            newPost = {
              ...newPost,
              title: post.title,
              text: post.selftext,
              link: `https://wwww.reddit.com/${post.id}`,
              platformCreatedAt: new Date(post.created_utc * 1000).toString()
            }

            break

          case "facebook":
            const textId = this.getFBTextId(post)

            newPost = {
              ...newPost,
              link: `https://facebook.com/${person.platform_account_id}/posts/${textId}`,
            }
            break
        }

        if (userCredential) {
          await this.createPostPublicMetric({
            ...newPost,
            walletAddress: userCredential.userId
          }, true)
        }

        await this.createPostPublicMetric(newPost, false)
      }
    } catch (e) {}
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
      const newKey = keyring.addFromUri('//' + newPost.id)

      await this.postRepository.updateById(newPost.id, {walletAddress: newKey.address})
    }
  }

  getFBTextId(post: any) {
    const link = post.link._text.split('=')
    return link[1].substring(0, link[1].length - 3)
  }

  async twitterPost(person: any, posts: any): Promise<void> {
    try {
      for (let j = 0; j < posts.length; j++) {
        const post = posts[j]
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
    } catch (err) { }
  }

  async redditPost(person: any, posts: any): Promise<void> {
    try {
      for (let j = 0; j < posts.length; j++) {
        const post = posts[j].data
        const foundPost = await this.postRepository.findOne({where: {textId: post.id, platform: 'reddit'}})

        if (foundPost) continue

        const userCredential = await this.userCredentialRepository.findOne({where: {peopleId: person.id}})
        const newPost = {
          platformUser: {
            username: person.username,
            platform_account_id: person.platform_account_id,
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

        if (userCredential) {
          await this.createPostPublicMetric({
            ...newPost,
            walletAddress: userCredential.userId,
          }, true)
        }

        await this.createPostPublicMetric(newPost, false)
      }
    } catch (err) { }
  }

  async facebookPost(person: any, posts: any): Promise<void> {
    try {
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
    } catch (err) { }
  }
}

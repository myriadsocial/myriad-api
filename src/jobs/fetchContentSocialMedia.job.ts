import {inject} from '@loopback/core'
import {CronJob, cronJob} from '@loopback/cron'
import {repository} from '@loopback/repository'
import {Keyring} from '@polkadot/api'
import { KeypairType } from '@polkadot/util-crypto/types'
import {xml2json} from 'xml-js'
import {
  PeopleRepository,
  PostRepository,
  PublicMetricRepository, 
  TagRepository,
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
      // cronTime: '*/10 * * * * *',
      start: true
    })
  }

  async performJob() {
    const people = await this.peopleRepository.find()

    for (let i = 0; i < people.length; i++) {
      const person = people[i]

      if (!person) continue
    
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

            const {data: newPosts} = await this.twitterService.getActions(`users/${person.platform_account_id}/tweets?since_id=${foundPosts[0].textId}&tweet.fields=attachments,entities,referenced_tweets,created_at,public_metrics`)

            if (!newPosts) break

            const twitterPosts = newPosts.filter((post: any) => !post.referenced_tweets)

            this.socialMediaPosts(person, twitterPosts)

            break

          case "reddit":
            const {data: user} = await this.redditService.getActions(`u/${person.username}.json?limit=10`)
            const redditPosts = user.children.filter((post: any) => {
              return post.kind === 't3'
            }).map((post: any) => post.data)

            this.socialMediaPosts(person, redditPosts)
            break

          case "facebook":
            const xml = await this.rsshubService.getContents(person.platform_account_id)
            const resultJSON = await xml2json(xml, {compact: true, trim: true})
            const responseFB = JSON.parse(resultJSON)

            const facebookPost = responseFB.rss.channel.item
            this.socialMediaPosts(person, facebookPost)
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

        const assets:string[] = []

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
          },
          platformCreatedAt: new Date().toString(),
        }

        switch (person.platform) {
          case "twitter":
            newPost = {
              ...newPost,
              platformPublicMetric: {
                retweet_count: post.public_metrics.retweet_count,
                like_count: post.public_metrics.like_count
              },
              text: post.text,
              link: `https://twitter.com/${person.platform_account_id}/status/${post.id}`,
              platformCreatedAt: post.created_at,
            }

            this.createTags(newPost.tags)

            break

          case "reddit":
            newPost = {
              ...newPost,
              title: post.title,
              text: post.selftext,
              link: `https://reddit.com/${post.id}`,
              platformCreatedAt: new Date(post.created_utc * 1000).toString()
            }

            if (newPost.hasMedia) {
              if (post.media_metadata) {
                for (const img in post.media_metadata) {
                  assets.push(post.media_metadata[img].s.u.replace(/amp;/g, ''))
                }
              }
              if (post.is_reddit_media_domain) {
                const images = post.preview.images || []
                const videos = post.preview.videos || []
  
                for (let i = 0; i < images.length; i++) {
                  assets.push(images[i].source.url.replace(/amp;/g,''))
                }
  
                for (let i = 0; i < videos.length; i++) {
                  assets.push(videos[i].source.url.replace(/amp;/g,''))
                }
              }
            }

            break

          case "facebook":
            const textId = this.getFBTextId(post)

            newPost = {
              ...newPost,
              link: `https://facebook.com/${person.username}/posts/${textId}`,
            }
            break
        }

        if (userCredential) {
          this.createPostPublicMetric({
            ...newPost,
            walletAddress: userCredential.userId,
            importBy: [userCredential.userId],
            assets: assets
          }, true)
        }

        this.createPostPublicMetric({
          ...newPost,
          assets: assets
        }, false)
      }
    } catch (e) {}
  }

  async createPostPublicMetric(post: any, credential: boolean): Promise<void> {
    const assets = [
      ...post.assets
    ]

    delete post.assets

    const newPost = await this.postRepository.create(post)

    if (post.platform === 'reddit' && assets.length > 0) {
      this.postRepository.asset(newPost.id).create({
        media_urls: assets
      })
    }

    this.publicMetricRepository.create({
      liked: 0,
      comment: 0,
      disliked: 0,
      postId: newPost.id
    })

    if (!credential) {
      const keyring = new Keyring({
        type: process.env.POLKADOT_CRYPTO_TYPE as KeypairType, 
        ss58Format: Number(process.env.POLKADOT_KEYRING_PREFIX)
      });
      const newKey = keyring.addFromUri('//' + newPost.id)

      this.postRepository.updateById(newPost.id, {walletAddress: newKey.address})
    }
  }

  getFBTextId(post: any) {
    const link = post.link._text.split('=')
    return link[1].substring(0, link[1].length - 3)
  }

  async createTags(tags:string[]):Promise<void> {
    const fetchTags = await this.tagRepository.find()
    const filterTags = tags.filter((tag:string) => {
      const foundTag = fetchTags.find((fetchTag:any) => fetchTag.id.toLowerCase() === tag.toLowerCase())

      if (foundTag) return false
      return true
    })

    if (filterTags.length === 0) return

    await this.tagRepository.createAll(filterTags.map((filterTag:string) => {
      return {
        id: filterTag,
        hide: false
      }
    }))
 }
}

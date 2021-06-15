import {inject} from '@loopback/core'
import {CronJob, cronJob} from '@loopback/cron'
import {repository} from '@loopback/repository'
import {Keyring} from '@polkadot/api'
import {u8aToHex} from '@polkadot/util'
import {KeypairType} from '@polkadot/util-crypto/types'
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
  Rsshub,
  Twitter
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
      cronTime: '0 0 */1 * * *',
      start: true
    })
  }

  async performJob() {
    const total = await this.peopleRepository.count();

    for (let i = 0; i < total.count; i++) {
      const person = (await this.peopleRepository.find({
        limit: 1,
        skip: i
      }))[0]

      switch (person.platform) {
        case "twitter":
          const foundPosts = await this.postRepository.find({
            order: ["textId DESC"],
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

          break;

        case "reddit":
          const {data: user} = await this.redditService.getActions(`u/${person.username}.json?limit=10`)
          const redditPosts = user.children.filter((post: any) => {
            return post.kind === 't3'
          }).map((post: any) => post.data)

          this.socialMediaPosts(person, redditPosts)

          break;

        case "facebook":
          try {
            const xml = await this.rsshubService.getContents(person.platform_account_id)
            const resultJSON = await xml2json(xml, {compact: true, trim: true})
            const responseFB = JSON.parse(resultJSON)

            const facebookPost = responseFB.rss.channel.item
            this.socialMediaPosts(person, facebookPost)
          } catch (err) { }

          break
      }
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

        const assets: string[] = []

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
                  assets.push(images[i].source.url.replace(/amp;/g, ''))
                }

                for (let i = 0; i < videos.length; i++) {
                  assets.push(videos[i].source.url.replace(/amp;/g, ''))
                }
              }
            }

            newPost = {
              ...newPost,
              title: post.title,
              text: post.selftext,
              link: `https://reddit.com/${post.id}`,
              platformCreatedAt: new Date(post.created_utc * 1000).toString(),
              assets
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
          }, true)
        }

        this.createPostPublicMetric({
          ...newPost,
        }, false)
      }
    } catch (e) { }
  }

  async createPostPublicMetric(post: any, credential: boolean): Promise<void> {
    if (!credential) {
      const keyring = new Keyring({
        type: process.env.MYRIAD_CRYPTO_TYPE as KeypairType,
      });
      const newKey = keyring.addFromUri('//' + post.peopleId)

      post.walletAddress = u8aToHex(newKey.publicKey)
    }

    const newPost = await this.postRepository.create(post)

    this.publicMetricRepository.create({
      liked: 0,
      comment: 0,
      disliked: 0,
      postId: newPost.id
    })
  }

  getFBTextId(post: any) {
    const link = post.link._text.split('=')
    return link[1].substring(0, link[1].length - 3)
  }

  async createTags(tags: string[]): Promise<void> {
    for (let i = 0; i < tags.length; i++) {
      const foundTag = await this.tagRepository.findOne({
        where: {
          or: [
            {
              id: tags[i]
            },
            {
              id: tags[i].toUpperCase()
            },
            {
              id: tags[i].toLowerCase()
            }
          ]
        }
      })

      if (foundTag) {
        const oneDay: number = 60 * 60 * 24 * 1000
        const isOneDay: boolean = new Date().getTime() - new Date(foundTag.updatedAt).getTime() > oneDay

        this.tagRepository.updateById(foundTag.id, {
          count: isOneDay ? 1 : foundTag.count + 1,
          updatedAt: new Date().toString()
        })
      } else {
        this.tagRepository.create({
          id: tags[i],
          createdAt: new Date().toString(),
          updatedAt: new Date().toString()
        })
      }
    }
  }
}

import {inject} from '@loopback/core';
import {cronJob, CronJob} from '@loopback/cron';
import {repository} from '@loopback/repository';
import {Keyring} from '@polkadot/api';
import { KeypairType } from '@polkadot/util-crypto/types';
import {
  PeopleRepository,
  PostRepository,


  PublicMetricRepository, TagRepository,
  UserCredentialRepository
} from '../repositories';
import {Reddit} from '../services';
import {u8aToHex} from '@polkadot/util'

@cronJob()
export class FetchContentRedditJob extends CronJob {
  constructor(
    @inject('services.Reddit') protected redditService: Reddit,
    @repository(PostRepository) public postRepository: PostRepository,
    @repository(PeopleRepository) public peopleRepository: PeopleRepository,
    @repository(TagRepository) public tagRepository: TagRepository,
    @repository(UserCredentialRepository) public userCredentialRepository: UserCredentialRepository,
    @repository(PublicMetricRepository) public publicMetricRepository: PublicMetricRepository
  ) {
    super({
      name: 'fetch-content-reddit-job',
      onTick: async () => {
        await this.performJob();
      },
      cronTime: '0 0 */1 * * *', // Every hour
      // cronTime: '*/10 * * * * *',
      start: true
    })
  }

  async performJob() {
    try {
      await this.searchPostByTag()
    } catch (e) {
      console.log(e)
    }
  }
  
  async searchPostByTag() {
    try {
      const tags = await this.tagRepository.find()
      const keyring = new Keyring({
        type: process.env.POLKADOT_CRYPTO_TYPE as KeypairType
      });

      for (let i = 0; i < tags.length; i++) {
        const tag = tags[i]
        const {data} = await this.redditService.getActions(`search.json?q=${tag.id}&sort=new&limit=10`)

        if (data.children.length === 0) continue

        const posts = data.children.filter((post: any) => {
          return post.kind === 't3'
        })

        for (let j = 0; j < posts.length; j++) {
          const post = posts[j].data
          const {data: userAbout} = await this.redditService.getActions(`u/${post.author}/about.json`)
          const profile_image_url = userAbout.icon_img.split('?')[0]
          const foundPost = await this.postRepository.findOne({where: {textId: post.id}})

          if (foundPost) {
            const foundTag = foundPost.tags.find(postTag => postTag.toLowerCase() === tag.id.toLowerCase())

            if (!foundTag) {
              this.postRepository.updateById(foundPost.id, {tags: [...foundPost.tags, tag.id]})
            }

            continue
          }

          const foundPerson = await this.peopleRepository.findOne({where: {username: post.author}})
          const newPost = {
            platformUser: {
              username: post.author,
              platform_account_id: post.author_fullname,
              profile_image_url
            },
            tags: [tag.id],
            platform: 'reddit',
            title: post.title,
            text: post.selftext,
            textId: post.id,
            hasMedia: post.media_metadata || post.is_reddit_media_domain ? true : false,
            link: `https://reddit.com/${post.id}`,
            platformCreatedAt: new Date(post.created_utc * 1000).toString(),
            createdAt: new Date().toString(),
            assets: []
          }

          const assets:string[] = []

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

          if (foundPerson) {
            const userCredential = await this.userCredentialRepository.findOne({where: {peopleId: foundPerson.id}})

            if (userCredential) {
              const result = await this.postRepository.create({
                ...newPost,
                assets,
                peopleId: foundPerson.id,
                walletAddress: userCredential.userId,
                importBy: [userCredential.userId]
              })
              this.publicMetricRepository.create({
                liked: 0,
                disliked: 0,
                comment: 0,
                postId: result.id
              })
            }
            const result = await this.postRepository.create({
              ...newPost,
              assets,
              peopleId: foundPerson.id
            })
            const newKey = keyring.addFromUri('//' + result.id)

            this.postRepository.updateById(result.id, {walletAddress: u8aToHex(newKey.publicKey)})
            this.publicMetricRepository.create({
              liked: 0,
              disliked: 0,
              comment: 0,
              postId: result.id
            })
          }

          const result = await this.postRepository.create({
            ...newPost,
            assets
          })
          const newKey = keyring.addFromUri('//' + result.id)

          this.postRepository.updateById(result.id, {walletAddress: u8aToHex(newKey.publicKey)})
          this.publicMetricRepository.create({
            liked: 0,
            disliked: 0,
            comment: 0,
            postId: result.id
          })
        }
      }
    } catch (err) { }
  }
}

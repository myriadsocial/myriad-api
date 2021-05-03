import {inject} from '@loopback/core';
import {cronJob, CronJob} from '@loopback/cron';
import {repository} from '@loopback/repository';
import {Keyring} from '@polkadot/api';
import {
  PeopleRepository, 
  PostRepository, 
  TagRepository, 
  UserCredentialRepository,
  PublicMetricRepository
} from '../repositories';
import {Reddit} from '../services';

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
      cronTime: '0 * */1 * * *',
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
      const keyring = new Keyring({type: 'sr25519', ss58Format: 214});

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
              const tags = foundPost.tags
              tags.push(tag.id)

              await this.postRepository.updateById(foundPost.id, {tags})
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
            link: `https://wwww.reddit.com/${post.id}`,
            platformCreatedAt: new Date(post.created_utc * 1000).toString()
          }

          if (foundPerson) {
            const userCredential = await this.userCredentialRepository.findOne({where: {peopleId: foundPerson.id}})

            if (userCredential) {
              const result = await this.postRepository.create({
                ...newPost,
                peopleId: foundPerson.id,
                walletAddress: userCredential.userId
              })
              await this.publicMetricRepository.create({
                liked: 0,
                disliked: 0,
                comment: 0,
                postId: result.id
              })
            }
            const result = await this.postRepository.create({
              ...newPost,
              peopleId: foundPerson.id
            })
            const newKey = keyring.addFromUri('//' + result.id)

            await this.postRepository.updateById(result.id, {walletAddress: newKey.address})
            await this.publicMetricRepository.create({
              liked: 0,
              disliked: 0,
              comment: 0,
              postId: result.id
            })
          }

          const result = await this.postRepository.create(newPost)
          const newKey = keyring.addFromUri('//' + result.id)

          await this.postRepository.updateById(result.id, {walletAddress: newKey.address})
          await this.publicMetricRepository.create({
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

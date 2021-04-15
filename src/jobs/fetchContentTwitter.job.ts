import {inject} from '@loopback/core'
import {CronJob, cronJob} from '@loopback/cron'
import {repository} from '@loopback/repository'
import {ApiPromise, Keyring, WsProvider} from '@polkadot/api'
import {PeopleRepository, PostRepository, TagRepository, UserCredentialRepository} from '../repositories'
import {Twitter} from '../services'

@cronJob()
export class FetchContentTwitterJob extends CronJob {
  constructor(
    @inject('services.Twitter') protected twitterService: Twitter,
    @repository(PostRepository) public postRepository: PostRepository,
    @repository(PeopleRepository) public peopleRepository: PeopleRepository,
    @repository(TagRepository) public tagRepository: TagRepository,
    @repository(UserCredentialRepository) public userCredentialRepository: UserCredentialRepository,
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

  async performJob() {
    const wsProvider = new WsProvider('wss://rpc.myriad.systems')
    const api = await ApiPromise.create({provider: wsProvider})

    await api.isReady

    await this.searchPostByPeople()
    await this.searchPostByTag()
  }

  async searchPostByPeople(): Promise<void> {
    try {
      const people = await this.peopleRepository.find({where: {platform: 'twitter'}})
      const posts = await this.postRepository.find({where: {platform: 'twitter'}})

      const keyring = new Keyring({type: 'sr25519', ss58Format: 42});

      for (let i = 0; i < people.length; i++) {
        const person = people[i]
        const personPosts = posts.filter(post => {
          if (post.platformUser) {
            return post.platformUser.platform_account_id === person.platform_account_id
          }

          return false
        })

        let maxId = ''

        personPosts.forEach(post => {
          const id = post.textId

          if (id > maxId) maxId = id
        })

        if (!maxId) continue

        const {data: newPosts} = await this.twitterService.getActions(`users/${person.platform_account_id}/tweets?since_id=${maxId}&tweet.fields=attachments,entities,referenced_tweets`)

        if (!newPosts) continue

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
            link: `https://twitter.com/${person.username}/status/${post.id}`,
            peopleId: person.id,
            platformUser: {
              username: person.username,
              platform_account_id: person.platform_account_id
            },
            createdAt: new Date().toString()
          }

          if (userCredential) {
            await this.postRepository.create({
              ...newPost,
              walletAddress: userCredential.userId
            })
          }

          const result = await this.postRepository.create(newPost)
          const newKey = keyring.addFromUri('//' + result.id)

          await this.postRepository.updateById(result.id, {walletAddress: newKey.address})
        }
      }
    } catch (err) { }
  }

  async searchPostByTag(): Promise<void> {
    try {
      const keyring = new Keyring({type: 'sr25519', ss58Format: 42});
      const tagsRepo = await this.tagRepository.find()

      for (let i = 0; i < tagsRepo.length; i++) {
        const tag = tagsRepo[i]

        const {data: newPosts, includes} = await this.twitterService.getActions(`tweets/search/recent?max_results=10&tweet.fields=referenced_tweets,attachments,entities&expansions=author_id&user.fields=id,username&query=%23${tag.id}`)
        const {users} = includes

        if (!newPosts) continue

        const filterNewPost = newPosts.filter((post: any) => !post.referenced_tweets)

        for (let j = 0; j < filterNewPost.length; j++) {
          const post = filterNewPost[j]
          const foundPost = await this.postRepository.findOne({where: {textId: post.id, platform: 'twitter'}})

          if (foundPost) continue

          const username = users.find((user: any) => user.id === post.author_id).username
          const tags = post.entities ? (post.entities.hashtags ? post.entities.hashtags.map((hashtag: any) => hashtag.tag.toLowerCase()) : []) : []
          const hasMedia = post.attachments ? Boolean(post.attachments.media_keys) : false
          const newPost = {
            tags,
            hasMedia,
            platform: 'twitter',
            text: post.text,
            textId: post.id,
            link: `https://twitter.com/${username}/status/${post.id}`,
            platformUser: {
              username,
              platform_account_id: post.author_id
            },
            createdAt: new Date().toString()
          }

          const foundPeople = await this.peopleRepository.findOne({where: {platform_account_id: post.author_id}})

          if (foundPeople) {
            const userCredential = await this.userCredentialRepository.findOne({where: {peopleId: foundPeople.id}})

            if (userCredential) {
              await this.postRepository.create({
                ...newPost,
                peopleId: foundPeople.id,
                walletAddress: userCredential.userId
              })
            }

            const result = await this.postRepository.create({
              ...newPost,
              peopleId: foundPeople.id
            })
            const newKey = keyring.addFromUri('//' + result.id)

            await this.postRepository.updateById(result.id, {walletAddress: newKey.address})
          }

          const result = await this.postRepository.create(newPost)
          const newKey = keyring.addFromUri('//' + result.id)

          await this.postRepository.updateById(result.id, {walletAddress: newKey.address})
        }
      }
    } catch (e) { }
  }
}

import {inject} from '@loopback/core';
import {CronJob, cronJob} from '@loopback/cron';
import {repository} from '@loopback/repository';
import {Keyring} from '@polkadot/api';
import {xml2json} from 'xml-js';
import {
  PeopleRepository,
  PostRepository,


  PublicMetricRepository, TagRepository,
  UserCredentialRepository
} from '../repositories';
import {Rsshub} from '../services';

@cronJob()
export class FetchContentFacebookJob extends CronJob {
  constructor(
    @inject('services.Rsshub') protected rsshubService: Rsshub,
    @repository(PostRepository) public postRepository: PostRepository,
    @repository(PeopleRepository) public peopleRepository: PeopleRepository,
    @repository(TagRepository) public tagRepository: TagRepository,
    @repository(UserCredentialRepository) public userCredentialRepository: UserCredentialRepository,
    @repository(PublicMetricRepository) public publicMetricRepository: PublicMetricRepository,
  ) {
    super({
      name: 'fetch-content-job',
      onTick: async () => {
        // do the work
        await this.performJob();
      },
      cronTime: '0 0 */1 * * *', // Every hour
      start: true,
    });
  }

  async performJob() {
    try {
      await this.searchPostByPeople()
    } catch (e) { }
  }

  async searchPostByPeople() {
    try {
      const people = await this.peopleRepository.find({where: {platform: "facebook"}})
      const keyring = new Keyring({type: 'sr25519', ss58Format: 214})

      for (let i = 0; i < people.length; i++) {
        const person = people[i]
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
            const result = await this.postRepository.create({
              ...newPost,
              walletAddress: userCredential.userId
            })
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
    } catch (e) {console.log('error')}
  }
}

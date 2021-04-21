import {inject} from '@loopback/core';
import {
  Filter,
  FilterExcludingWhere,
  repository
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  put,
  requestBody,
  response
} from '@loopback/rest';
import {Keyring} from '@polkadot/api';
import dotenv from 'dotenv';
import {xml2json} from 'xml-js';
import {People} from '../models';
import {PeopleRepository, PostRepository, TagRepository, UserCredentialRepository, UserRepository} from '../repositories';
import {Reddit, Rsshub, Twitter, Facebook} from '../services';
dotenv.config()

export class PeopleController {
  constructor(
    @repository(PeopleRepository)
    public peopleRepository: PeopleRepository,
    @repository(PostRepository)
    public postRepository: PostRepository,
    @repository(TagRepository)
    public tagRepository: TagRepository,
    @repository(UserCredentialRepository)
    public userCredentialRepository: UserCredentialRepository,
    @repository(UserRepository)
    public userRepository: UserRepository,
    @inject('services.Twitter') protected twitterService: Twitter,
    @inject('services.Reddit') protected redditService: Reddit,
    @inject('services.Rsshub') protected rsshubService: Rsshub,
    @inject('services.Facebook') protected facebookService: Facebook
  ) { }

  @post('/people')
  @response(200, {
    description: 'People model instance',
    content: {'application/json': {schema: getModelSchemaRef(People)}}
  })

  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(People, {
            title: 'NewPeople',
          })
        }
      }
    })
    people: People
  ): Promise<People> {
    const findPeople = await this.peopleRepository.findOne({where: {platform_account_id: people.platform_account_id}})

    if (!findPeople) {
      const newPeople = await this.peopleRepository.create(people)
      // const wsProvider = new WsProvider('wss://rpc.myriad.systems')
      // const api = await ApiPromise.create({provider: wsProvider})

      // await api.isReady

      switch (newPeople.platform) {
        case "twitter":
          await this.createTwitterPostByPeople(newPeople)
          break

        case "reddit":
          await this.createRedditPostByPeople(newPeople)
          break

        case "facebook":
          await this.createFBPostByPeople(newPeople)
          break
      }

      return newPeople
    }

    return findPeople
  }

  @get('/people')
  @response(200, {
    description: 'Array of People model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(People, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(People) filter?: Filter<People>,
  ): Promise<People[]> {
    return this.peopleRepository.find(filter);
  }

  // @get('/people/count')
  // @response(200, {
  //   description: 'People model count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async count(
  //   @param.where(People) where?: Where<People>,
  // ): Promise<Count> {
  //   return this.peopleRepository.count(where);
  // }

  // @patch('/people')
  // @response(200, {
  //   description: 'People PATCH success count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async updateAll(
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(People, {partial: true}),
  //       },
  //     },
  //   })
  //   people: People,
  //   @param.where(People) where?: Where<People>,
  // ): Promise<Count> {
  //   return this.peopleRepository.updateAll(people, where);
  // }

  @get('/people/{id}')
  @response(200, {
    description: 'People model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(People, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(People, {exclude: 'where'}) filter?: FilterExcludingWhere<People>
  ): Promise<People> {
    return this.peopleRepository.findById(id, filter);
  }

  @patch('/people/{id}')
  @response(204, {
    description: 'People PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(People, {partial: true}),
        },
      },
    })
    people: People,
  ): Promise<void> {
    await this.peopleRepository.updateById(id, people);
  }

  @put('/people/{id}')
  @response(204, {
    description: 'People PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() people: People,
  ): Promise<void> {
    await this.peopleRepository.replaceById(id, people);
  }

  @del('/people/{id}')
  @response(204, {
    description: 'People DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.peopleRepository.deleteById(id);
  }

  async createTwitterPostByPeople(people: People): Promise<void> {
    try {
      const {data: tweets} = await this.twitterService.getActions(`users/${people.platform_account_id}/tweets?max_results=5&tweet.fields=attachments,entities,referenced_tweets`)
      const filterTweets = tweets.filter((post: any) => !post.referenced_tweets)
      const keyring = new Keyring({type: 'sr25519', ss58Format: 214});

      for (let i = 0; i < filterTweets.length; i++) {
        const tweet = filterTweets[i]
        const foundTweet = await this.postRepository.findOne({where: {textId: tweet.id, platform: "twitter"}})

        if (foundTweet) continue

        const userCredentials = await this.userCredentialRepository.findOne({where: {peopleId: people.id}})
        const tags = tweet.entities ? tweet.entities.hashtags ? tweet.entities.hashtags.map((hashtag: any) => hashtag.tag) : [] : []
        const hasMedia = tweet.attachments ? Boolean(tweet.attachments.media_keys) : false
        const newPost = {
          tags,
          hasMedia,
          platform: 'twitter',
          text: tweet.text,
          textId: tweet.id,
          link: `https://twitter.com/${people.username}/status/${tweet.id}`,
          peopleId: people.id,
          platformUser: {
            username: people.username,
            platform_account_id: people.platform_account_id
          },
          createdAt: new Date().toString()
        }

        if (userCredentials) {
          await this.postRepository.create({
            ...newPost,
            walletAddress: userCredentials.userId
          })
        }

        const result = await this.postRepository.create(newPost)
        const newKey = keyring.addFromUri('//' + result.id)
        await this.postRepository.updateById(result.id, {walletAddress: newKey.address})
      }
    } catch (err) { }
  }

  async createRedditPostByPeople(people: People): Promise<void> {
    try {
      const keyring = new Keyring({type: 'sr25519', ss58Format: 214});
      const {data: user} = await this.redditService.getActions(`u/${people.username}.json?limit=5`)
      const redditPost = await this.postRepository.find({where: {platform: 'reddit'}})

      user.children.filter((post: any) => {
        return !redditPost.find(e => post.data.id === e.textId) && post.kind === 't3'
      }).forEach(async (post: any) => {
        const e = post.data
        const newPost = {
          platformUser: {
            username: people.username,
            platform_account_id: people.platform_account_id,
          },
          tags: [],
          platform: 'reddit',
          title: e.title,
          text: e.selftext,
          textId: e.id,
          peopleId: people.id,
          hasMedia: e.media_metadata || e.is_reddit_media_domain ? true : false,
          link: `https://reddit.com/${e.id}`,
          createdAt: new Date().toString()
        }

        const userCredential = await this.userCredentialRepository.findOne({where: {peopleId: people.id}})

        if (userCredential) {
          await this.postRepository.create({
            ...newPost,
            walletAddress: userCredential.userId
          })
        }

        const result = await this.postRepository.create(newPost)
        const newKey = keyring.addFromUri('//' + result.id)

        await this.postRepository.updateById(result.id, {walletAddress: newKey.address})
      })
    } catch (err) { }
  }

  async createFBPostByPeople(people: People): Promise<void> {
    try {
      const keyring = new Keyring({type: 'sr25519', ss58Format: 214});
      const xml = await this.rsshubService.getContents(people.platform_account_id)
      const resultJSON = await xml2json(xml, {compact: true, trim: true})
      const response = JSON.parse(resultJSON)

      response.rss.channel.items.forEach(async (post: any) => {
        const link = post.link._text.split("=")
        const platform_account_id = link[2]
        const textId = link[1].substr(0, link[1].length - 3)

        const foundPost = await this.postRepository.findOne({where: {textId, platform: 'facebook'}})

        if (!foundPost) {
          const newPost = {
            platformUser: {
              username: people.username,
              platform_account_id,
            },
            tags: [],
            platform: 'facebook',
            title: "",
            text: "",
            textId,
            peopleId: people.id,
            hasMedia: false,
            link: `https://facebook.com/${platform_account_id}/posts/${textId}`,
            createdAt: new Date().toString()
          }

          const userCredential = await this.userCredentialRepository.findOne({where: {peopleId: people.id}})

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
      })
    } catch (err) { }
  }
}

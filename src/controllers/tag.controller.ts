import {inject} from '@loopback/core';
import {
  Filter,
  FilterExcludingWhere,
  repository
} from '@loopback/repository';
import {
  get,
  getModelSchemaRef,
  param,
  post,
  requestBody,
  response
} from '@loopback/rest';
import {Keyring} from '@polkadot/api';
import {Tag} from '../models';
import {PeopleRepository, PostRepository, TagRepository, UserCredentialRepository} from '../repositories';
import {Reddit, Twitter} from '../services';

export class TagController {
  constructor(
    @repository(TagRepository)
    public tagRepository: TagRepository,
    @repository(PeopleRepository)
    public peopleRepository: PeopleRepository,
    @repository(PostRepository)
    public postRepository: PostRepository,
    @repository(UserCredentialRepository)
    public userCredentialRepository: UserCredentialRepository,
    @inject('services.Twitter') protected twitterService: Twitter,
    @inject('services.Reddit') protected redditService: Reddit
  ) { }

  @post('/tags')
  @response(200, {
    description: 'Tag By Platform model instance',
    content: {'application/json': {schema: getModelSchemaRef(Tag)}},
  })
  async createTagByPlatform(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Tag, {
            title: 'NewTag',

          }),
        },
      },
    })
    tag: Tag,
  ): Promise<any> {
    const keyword = tag.id.replace(/ /g, '').trim().toLowerCase();
    const foundTag = await this.tagRepository.findOne({where: {id: keyword}})

    // const wsProvider = new WsProvider('wss://rpc.myriad.systems')
    // const api = await ApiPromise.create({provider: wsProvider})

    // await api.isReady

    if (foundTag) return false

    const searchTwitter = await this.searchTweetsByKeyword(keyword)
    const searchFacebook = await this.searchFbPostsByKeyword(keyword)
    const searchReddit = await this.searchRedditPostByKeyword(keyword)

    if (searchTwitter || searchFacebook || searchReddit) {
      return this.tagRepository.create({
        ...tag,
        id: keyword
      })
    }

    return false
  }

  // @get('/tags/count')
  // @response(200, {
  //   description: 'Tag model count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async count(
  //   @param.where(Tag) where?: Where<Tag>,
  // ): Promise<Count> {
  //   return this.tagRepository.count(where);
  // }

  @get('/tags')
  @response(200, {
    description: 'Array of Tag model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Tag, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Tag) filter?: Filter<Tag>,
  ): Promise<Tag[]> {
    return this.tagRepository.find(filter);
  }

  // @patch('/tags')
  // @response(200, {
  //   description: 'Tag PATCH success count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async updateAll(
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(Tag, {partial: true}),
  //       },
  //     },
  //   })
  //   tag: Tag,
  //   @param.where(Tag) where?: Where<Tag>,
  // ): Promise<Count> {
  //   return this.tagRepository.updateAll(tag, where);
  // }

  @get('/tags/{id}')
  @response(200, {
    description: 'Tag model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Tag, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Tag, {exclude: 'where'}) filter?: FilterExcludingWhere<Tag>
  ): Promise<Tag> {
    return this.tagRepository.findById(id, filter);
  }

  // @patch('/tags/{id}')
  // @response(204, {
  //   description: 'Tag PATCH success',
  // })
  // async updateById(
  //   @param.path.string('id') id: string,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(Tag, {partial: true}),
  //       },
  //     },
  //   })
  //   tag: Tag,
  // ): Promise<void> {
  //   await this.tagRepository.updateById(id, tag);
  // }

  // @put('/tags/{id}')
  // @response(204, {
  //   description: 'Tag PUT success',
  // })
  // async replaceById(
  //   @param.path.string('id') id: string,
  //   @requestBody() tag: Tag,
  // ): Promise<void> {
  //   await this.tagRepository.replaceById(id, tag);
  // }

  // @del('/tags/{id}')
  // @response(204, {
  //   description: 'Tag DELETE success',
  // })
  // async deleteById(@param.path.string('id') id: string): Promise<void> {
  //   await this.tagRepository.deleteById(id);
  // }

  async searchTweetsByKeyword(keyword: string): Promise<Boolean> {
    try {
      const {data: posts, includes} = await this.twitterService.getActions(`tweets/search/recent?max_results=10&tweet.fields=referenced_tweets,attachments,entities&expansions=author_id&user.fields=id,username&query=%23${keyword}`)
      const keyring = new Keyring({type: 'sr25519', ss58Format: 214});

      if (!posts) return false

      const {users} = includes
      const filterPost = posts.filter((post: any) => !post.referenced_tweets)

      for (let i = 0; i < filterPost.length; i++) {
        const post = filterPost[i]
        const foundPost = await this.postRepository.findOne({where: {textId: post.id, platform: 'twitter'}})
        const username = users.find((user: any) => user.id === post.author_id).username

        if (foundPost) continue

        const tags = post.entities ? post.entities.hashtags ? post.entities.hashtags.map((hashtag: any) => hashtag.tag.toLowerCase()) : [] : []
        const hasMedia = post.attachments ? Boolean(post.attachments.media_keys) : false

        const newPost = {
          tags,
          hasMedia,
          platform: "twitter",
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
              walletAddress: userCredential.id,
              peopleId: foundPeople.id
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

      return true
    } catch (err) { }

    return false
  }

  async searchFbPostsByKeyword(keyword: string): Promise<boolean> {
    return false
  }

  async searchRedditPostByKeyword(keyword: string): Promise<boolean> {
    try {
      const {data} = await this.redditService.getActions(`search.json?q=${keyword}&sort=new&limit=5`)
      const keyring = new Keyring({type: 'sr25519', ss58Format: 214});

      if (data.children.length === 0) return false

      data.children.filter((post: any) => {
        return post.kind === 't3'
      }).forEach(async (post: any) => {
        const e = post.data
        const foundPerson = await this.peopleRepository.findOne({where: {username: e.author}})
        const newPost = {
          platformUser: {
            username: e.author,
            platform_account_id: e.author_fullname
          },
          tags: [keyword],
          platform: 'reddit',
          title: e.title,
          text: e.selftext,
          textId: e.id,
          hasMedia: e.media_metadata || e.is_reddit_media_domain ? true : false,
          link: `https://www.reddit.com/${e.id}`,
          createdAt: new Date().toString()
        }

        if (foundPerson) {
          const userCredential = await this.userCredentialRepository.findOne({where: {peopleId: foundPerson.id}})

          if (userCredential) {
            await this.postRepository.create({
              ...newPost,
              peopleId: foundPerson.id,
              walletAddress: userCredential.userId
            })
          }

          const result = await this.postRepository.create({
            ...newPost,
            peopleId: foundPerson.id
          })
          const newKey = keyring.addFromUri('//' + result.id)

          await this.postRepository.updateById(result.id, {walletAddress: newKey.address})
        }

        const result = await this.postRepository.create(newPost)
        const newKey = keyring.addFromUri('//' + result.id)

        await this.postRepository.updateById(result.id, {walletAddress: newKey.address})
      })

      return true
    } catch (e) { }

    return false
  }
}

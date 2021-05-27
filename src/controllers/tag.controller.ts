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
  response,
  HttpErrors
} from '@loopback/rest';
import {Keyring} from '@polkadot/api';
import { KeypairType } from '@polkadot/util-crypto/types';
import {Post, Tag} from '../models';
import {
  PeopleRepository,
  PostRepository,
  TagRepository, 
  UserCredentialRepository,
  PublicMetricRepository
} from '../repositories';
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
    @repository(PublicMetricRepository)
    public publicMetricRepository: PublicMetricRepository,
    @inject('services.Twitter') protected twitterService: Twitter,
    @inject('services.Reddit') protected redditService: Reddit
  ) { }

  @get('/trending', {
    responses: {
      '200': {
        description: 'Trending topic'
      }
    }
  })
  async trendingTopic(
    @param.query.string('order') order:string,
    @param.query.string('limit') limit:number,
    @param.query.string('offset') offset:number
  ):Promise<Tag[]> {
    if (!order) order = "DESC";
    if (!limit) limit = 10;
    if (!offset) offset = 0;
    
    return this.tagRepository.find({
      order: [`count ${order.toUpperCase()}`],
      limit: limit,
      offset: offset
    })
  }

  @get('/trending/{topic}', {
    responses: {
      '200': {
        description: 'Post based trending topic'
      }
    }
  })
  async trendingPost(
    @param.path.string('topic') topic: string,
    @param.query.string('order') order:string,
    @param.query.string('limit') limit:number,
    @param.query.string('offset') offset:number
  ): Promise<Post[]> {
    if (!order) order = 'DESC'
    if (!limit) limit = 10
    if (!offset) offset = 0

    return this.postRepository.find({
      where: {
        tags: {
          inq: [[topic]]
        }
      },
      include: [
        {
          relation: 'comments',
          scope: {
            include: ['user']
          }
        },
        {
          relation: 'publicMetric'
        },
        {
          relation: 'tags'
        }
      ],
      order: [`platformCreatedAt ${order.toUpperCase()}`],
      limit: limit,
      offset: offset
    })
  }

  @post('/tags/{platform}')
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
    @param.path.string('platform') platform:string
  ): Promise<Tag> {
    const keyword = tag.id.replace(/ /g, '').trim();
    const searchPost = await this.searchPostByKeyword(keyword, platform)

    if (searchPost) {
      const foundTag = await this.tagRepository.findOne({
        where: {
          or: [
            {id: keyword},
            {id: keyword.toLowerCase()},
            {id: keyword.toUpperCase()}
          ]
        }
      })

      if (!foundTag) {
        return this.tagRepository.create({
          id: keyword,
        })
      }
      
      return foundTag
    } else {
      throw new HttpErrors.NotFound(`Topic ${tag.id} is not found in ${platform}`)
    }
  }
  
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

  async searchPostByKeyword(keyword: string, platform: string): Promise<boolean> {
    if (platform === "facebook") return false

    try {
      const {posts, users} = await this.socialMediaPost(platform, keyword)

      for (let i = 0; i < posts.length; i++) {
        let user = null;

        const post = posts[i]
        const foundPost = await this.postRepository.findOne({
          where: {
            textId: post.id,
            platform
          }
        })

        if (foundPost) {
          await this.updatePostTag(foundPost, keyword)
          continue
        }

        if (platform === 'twitter') {
          user = users.find((user: any) => user.id === post.author_id)
        } else if (platform === 'reddit') {
          const response = await this.redditService.getActions(`user/${post.author}/about.json`)

          user = response.data
        } else {
          throw new Error('User not found')
        }

        const newPost = await this.newPost(post, {
          username: user.name,
          platform_account_id: platform === "twitter" ? user.id : "t2_" + user.id,
          profile_image_url: platform === "twitter" ? user.profile_image_url.replace("normal", "400x400") : user.icon_img.split('?')[0],
          platform
        }, keyword)

        const foundPerson = await this.peopleRepository.findOne({
          where: {
            platform_account_id: platform === "twitter" ? user.id : post.author_fullname,
            platform
          }
        })

        if (foundPerson) {
          const userCredential = await this.userCredentialRepository.findOne({
            where: {
              peopleId: foundPerson.id
            }
          })

          if (userCredential) {
            await this.createPostPublicMetric({
              ...newPost,
              peopleId: foundPerson.id,
              walletAddress: userCredential.userId
            }, true)
          }

          await this.createPostPublicMetric({
            ...newPost,
            peopleId: foundPerson.id
          }, false)
        }

        await this.createPostPublicMetric(newPost, false)
      }

      return true
    } catch (err) {
      return false
    }
  }

  async createPostPublicMetric(post:object, credential:boolean):Promise<void> {
    const newPost = await this.postRepository.create(post)

    await this.publicMetricRepository.create({
      liked: 0,
      disliked: 0,
      comment: 0,
      postId: newPost.id
    })

    if (!credential) {
      const keyring = new Keyring({
        type: process.env.POLKADOT_CRYPTO_TYPE as KeypairType, 
        ss58Format: Number(process.env.POLKADOT_KEYRING_PREFIX)
      });
      const newKey = keyring.addFromUri('//' + newPost.id)
      
      await this.postRepository.updateById(newPost.id, {walletAddress: newKey.address});
    }
  }

  async updatePostTag(post:Post, keyword:string):Promise<void> {
    const found = post.tags.find(tag => tag.toLowerCase() === keyword.toLowerCase())
          
    if (!found) {
      this.postRepository.updateById(post.id, {tags: [...post.tags, keyword]})
    } 

    const foundTag = await this.tagRepository.findOne({
      where: {
        or: [
          {
            id: keyword
          },
          {
            id: keyword.toLowerCase()
          },
          {
            id: keyword.toUpperCase()
          }
        ]
      }
    })

    if (!foundTag) {
      this.tagRepository.create({
        id: keyword,
        count: 1,
        createdAt: new Date().toString(),
        updatedAt: new Date().toString()
      })
    }
    
  }

  async socialMediaPost(platform:string, keyword: string) {
    switch(platform) {
      case "twitter":
        const maxResult = 10
        const tweetField = "referenced_tweets,attachments,entities,created_at"
        const expansionsField = "author_id"
        const userField = "id,username,profile_image_url"

        const {data: tweets, includes} = await this.twitterService.getActions(`tweets/search/recent?max_results=${maxResult}&tweet.fields=${tweetField}&expansions=${expansionsField}&user.fields=${userField}&query=${keyword}`)

        if (!tweets) throw new Error("Tweets doesn't exists")

        const filterTweets = tweets.filter((post: any) => !post.referenced_tweets)

        return {
          posts: filterTweets,
          users: includes.users,
        }

      case "reddit":
        const {data} = await this.redditService.getActions(`search.json?q=${keyword}&sort=new&limit=5`)

        if (data.children.length === 0) throw new Error("Reddit post doesn't exists")

        const filterPost = data.children.filter((post:any) => post.kind === 't3')

        return {
          posts: filterPost.map((post:any) => post.data),
          users: {}
        }
      
      default:
        throw new Error("Platform does not exists")
    }
  }

  async newPost (post:any, people:any, keyword:string) {
    let hasMedia:boolean = false
    let link:string
    let platformCreatedAt:string
    let tags: string[] = []
    
    const newPost = {
      platformUser: {
        username: people.username,
        platform_account_id: people.platform_account_id,
        profile_image_url: people.profile_image_url
      },
      platform: people.platform,
      textId: post.id,
      createdAt: new Date().toString()
    }

    switch (people.platform) {
      case "twitter":
        tags = post.entities ? (post.entities.hashtags ? 
          post.entities.hashtags.map((hashtag: any) => hashtag.tag) : []
        ) : []

        hasMedia = post.attachments ? Boolean(post.attachments.media_keys) : false
        link = `https://twitter.com/${people.platform_account_id}/status/${post.id}`
        platformCreatedAt = post.created_at

        await this.createTags([...tags, keyword])

        return {
          ...newPost,
          tags: tags.find((tag:string) => tag.toLowerCase() === keyword.toLowerCase()) ? tags : [...tags, keyword],
          text: post.text,
          hasMedia, link, platformCreatedAt
        }

      case "reddit":
        hasMedia = post.media_metadata || post.is_reddit_media_domain ? true : false
        platformCreatedAt = new Date(post.created_utc * 1000).toString()
        link = `https://reddit.com/${post.id}`

        await this.createTags([keyword])

        return {
          ...newPost,
          title: post.title,
          text: post.selftext,
          tags: [keyword], hasMedia, link, platformCreatedAt
        }
      
      case "facebook":
        return {
          ...newPost,
          platformUser: {
            username: people.username,
            platform_account_id: people.platform_account_id
          },
          title: "",
          text: "",
          hasMedia,
          tags,
          platformCreatedAt: new Date().toString()
        }

      default:
        throw new Error("Platform doesn't exists")
    }
  }

  async createTags(tags:string[]):Promise<void> {
    // const fetchTags = await this.tagRepository.find()
    // const filterTags = tags.filter((tag:string) => {
    //   const foundTag = fetchTags.find((fetchTag:any) => fetchTag.id.toLowerCase() === tag.toLowerCase())

    //   if (foundTag) return false
    //   return true
    // })

    // if (filterTags.length === 0) return

    // await this.tagRepository.createAll(filterTags.map((filterTag:string) => {
    //   return {
    //     id: filterTag,
    //     hide: false
    //   }
    // }))

    for (let i = 0; i < tags.length; i++) {
      const foundTag = await this.tagRepository.findOne({
        where: {
          or: [
            {
              id: tags[i].toLowerCase()
            },
            {
              id: tags[i].toUpperCase()
            },
            {
              id: tags[i]
            }
          ]
        }
      })

      if (!foundTag) {
        this.tagRepository.create({
          id: tags[i],
          count: 1,
          createdAt: new Date().toString(),
          updatedAt: new Date().toString()
        })
      } else {
        const oneDay:number = 60 * 60 * 24 * 1000;
          const isOneDay:boolean = new Date().getTime() - new Date(foundTag.updatedAt).getTime() > oneDay;

          this.tagRepository.updateById(foundTag.id, {
            updatedAt: new Date().toString(),
            count: isOneDay ? 1 : foundTag.count + 1
          }) 
      }
    }
 }
}

import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  response,
} from '@loopback/rest';
import {Tag} from '../models';
import {PeopleRepository, PostRepository, TagRepository} from '../repositories';
import {inject} from '@loopback/core'
import {Twitter} from '../services'

export class TagController {
  constructor(
    @repository(TagRepository)
    public tagRepository : TagRepository,
    @repository(PeopleRepository)
    public peopleRepository:PeopleRepository,
    @repository(PostRepository)
    public postRepository:PostRepository,
    @inject('services.Twitter') protected    twitterService:Twitter,
  ) {}

  @post('/tags')
  @response(200, {
    description: 'Tag model instance',
    content: {'application/json': {schema: getModelSchemaRef(Tag)}},
  })
  async create(
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
  ): Promise<Tag> {
    return this.tagRepository.create(tag);
  }

  @post('/tags/{platform}')
  @response(200, {
    description: 'Tag By Platform model instance',
    content: { 'application/json': { schema: getModelSchemaRef(Tag) } },
  })
  async createTagByPlatform(
    @param.query.string('keyword') keyword:string,
    @param.path.string('platform') platform:string,
    ):Promise<any> {

    if (platform === 'twitter') {
      return await this.searchByKeyword(keyword)
    }

    if (platform === 'facebook') {
      
    }

    if (platform === 'twitter') {
      
    }
  }

  @get('/tags/count')
  @response(200, {
    description: 'Tag model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Tag) where?: Where<Tag>,
  ): Promise<Count> {
    return this.tagRepository.count(where);
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

  @patch('/tags')
  @response(200, {
    description: 'Tag PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Tag, {partial: true}),
        },
      },
    })
    tag: Tag,
    @param.where(Tag) where?: Where<Tag>,
  ): Promise<Count> {
    return this.tagRepository.updateAll(tag, where);
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

  @patch('/tags/{id}')
  @response(204, {
    description: 'Tag PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Tag, {partial: true}),
        },
      },
    })
    tag: Tag,
  ): Promise<void> {
    await this.tagRepository.updateById(id, tag);
  }

  @put('/tags/{id}')
  @response(204, {
    description: 'Tag PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() tag: Tag,
  ): Promise<void> {
    await this.tagRepository.replaceById(id, tag);
  }

  @del('/tags/{id}')
  @response(204, {
    description: 'Tag DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.tagRepository.deleteById(id);
  }

  async searchByKeyword (keyword:string):Promise<any>{
    const { data: posts } = await this.twitterService.getActions(`tweets/search/recent?max_results=50&tweet.fields=referenced_tweets&expansions=attachments.media_keys,author_id&user.fields=description&query=${keyword}`)

    if (!posts || posts.errors) return null

    const newTag = await this.tagRepository.create({
      id: keyword,
      createdAt: new Date().toString()
    })

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i]
      const hasMedia = Boolean(post.attachments)
      const tags = post.text.split(' ')
        .filter(function (word: string) {
          return word.startsWith('#')
        })
        .map(function (word: string) {
          return word.substr(1).trim()
        })

      if (!post.referenced_tweets) {
        interface Post {
          text: string,
          textId: string,
          createdAt: string,
          people?: object,
          platform: string,
          hasMedia: boolean,
          tags?: string[],
          link: string
        }

        const { data: user } = await this.twitterService.getActions(`users/${post.author_id}`)

        const newPost: Post = {
          text: post.text,
          textId: post.id,
          createdAt: new Date().toString(),
          platform: 'twitter',
          hasMedia: false,
          link: `https://twitter.com/${user.username}/status/${post.id}`,
          tags: []
        }

        if (hasMedia) newPost.hasMedia = true

        if (tags.length > 0) {
          newPost.tags = tags

          for (let i = 0; i < tags.length; i++) {
            const findTag = await this.tagRepository.find({
              where: { id: tags[i].toLowerCase() }
            })

            if (findTag.length === 0) {
              await this.tagRepository.create({
                id: tags[i],
                createdAt: new Date().toString()
              })
            }
          }
        }

        const findDuplicateKeyWord = newPost.tags?.find(tag => tag.toLowerCase() === keyword.toLowerCase())

        if (!findDuplicateKeyWord) {
          newPost.tags?.push(keyword)
        }

        this.postRepository.create(newPost)
      }
    }

    return newTag
  } 
}

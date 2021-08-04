import {intercept, service} from '@loopback/core';
import {Filter, FilterExcludingWhere} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  HttpErrors,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {PlatformType} from '../enums';
import {defaultFilterQuery} from '../helpers/filter-utils';
import {UrlUtils} from '../helpers/url.utils';
import {PaginationInterceptor} from '../interceptors';
import {ExtendedPost} from '../interfaces';
import {Post, PublicMetric} from '../models';
import {PlatformPost} from '../models/platform-post.model';
import {PostService, SocialMediaService, TagService} from '../services';
// @authenticate("jwt")

@intercept(PaginationInterceptor.BINDING_KEY)
export class PostController {
  constructor(
    @service(TagService)
    protected tagService: TagService,
    @service(SocialMediaService)
    protected socialMediaService: SocialMediaService,
    @service(PostService)
    protected postService: PostService,
  ) {}

  @post('/posts')
  @response(200, {
    description: 'Post model instance',
    content: {'application/json': {schema: getModelSchemaRef(Post)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['text', 'walletAddress'],
            properties: {
              text: {
                type: 'string',
              },
              tags: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              asset: {
                type: 'object',
                properties: {
                  images: {
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                  },
                  videos: {
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                  },
                },
              },
              walletAddress: {
                type: 'string',
              },
            },
          },
        },
      },
    })
    _post: Omit<Post, 'id'>,
  ): Promise<Post> {
    if (_post.asset) {
      if (_post.asset.images.length && _post.asset.videos.length > 0) {
        _post.hasMedia = true;
      }
    }

    _post.createdAt = new Date().toString();
    _post.updatedAt = new Date().toString();
    _post.platformCreatedAt = new Date().toString();
    _post.platform = PlatformType.MYRIAD;

    const newPost = await this.postService.postRepository.create(_post);

    this.postService.postRepository.publicMetric(newPost.id).create({}) as Promise<PublicMetric>;

    if (_post.tags.length > 0) {
      this.tagService.createTags(_post.tags) as Promise<void>;
    }

    return newPost;
  }

  @post('/posts/import')
  @response(200, {
    description: 'Post',
    content: {'application/json': {schema: getModelSchemaRef(Post)}},
  })
  async importURL(
    @requestBody({
      description: 'Import post',
      content: {
        'application/json': {
          schema: getModelSchemaRef(PlatformPost),
        },
      },
    })
    platformPost: PlatformPost,
  ): Promise<Post> {
    const urlUtils = new UrlUtils(platformPost.url);

    const platform = urlUtils.getPlatform();
    const textId = urlUtils.getTextId();
    const username = urlUtils.getUsername();

    const newTags = platformPost.tags;
    const importer = platformPost.importer;

    const foundPost = await this.postService.postRepository.findOne({
      where: {textId, platform},
    });

    if (foundPost) {
      const foundImporter = foundPost.importBy.find(userId => userId === importer);

      if (foundImporter)
        throw new HttpErrors.UnprocessableEntity('You have already import this post');

      foundPost.importBy.push(importer);

      this.postService.postRepository.updateById(foundPost.id, {
        importBy: foundPost.importBy,
      }) as Promise<void>;

      return foundPost;
    }

    let newPost: ExtendedPost;
    let tags: string[] = newTags;

    switch (platform) {
      case PlatformType.TWITTER: {
        newPost = await this.socialMediaService.fetchTweet(textId);

        if (newPost.tags) {
          const postTags = newPost.tags.filter((tag: string) => {
            return !newTags
              .map((newTag: string) => newTag.toLowerCase())
              .includes(tag.toLowerCase());
          });

          tags = [...tags, ...postTags];
        }

        break;
      }

      case PlatformType.REDDIT: {
        newPost = await this.socialMediaService.fetchRedditPost(textId);

        break;
      }

      case PlatformType.FACEBOOK: {
        if (!username) {
          throw new HttpErrors.UnprocessableEntity('Username not found!');
        }

        newPost = await this.socialMediaService.fetchFacebookPost(username, textId);

        break;
      }

      default:
        throw new HttpErrors.NotFound('Cannot found the specified url!');
    }

    newPost.tags = tags;
    newPost.importBy = [importer];
    newPost.importerId = importer;

    this.tagService.createTags(newPost.tags) as Promise<void>;

    return this.postService.createPost(newPost);
  }

  @get('/posts')
  @response(200, {
    description: 'Array of Post model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Post, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.query.number('page') page: number,
    @param.filter(Post, {exclude: ['skip', 'offset']}) filter?: Filter<Post>,
  ): Promise<Post[]> {
    filter = defaultFilterQuery(page, filter);

    return this.postService.postRepository.find(filter);
  }

  @get('/posts/{id}')
  @response(200, {
    description: 'Post model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Post, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Post, {exclude: 'where'}) filter?: FilterExcludingWhere<Post>,
  ): Promise<Post> {
    return this.postService.postRepository.findById(id, filter);
  }

  @patch('/posts/{id}')
  @response(204, {
    description: 'Post PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Post, {partial: true}),
        },
      },
    })
    _post: Post,
  ): Promise<void> {
    _post.updatedAt = new Date().toString();
    await this.postService.postRepository.updateById(id, _post);
  }

  @del('/posts/{id}')
  @response(204, {
    description: 'Post DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.postService.postRepository.deleteById(id);
  }
}

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
import {UrlUtils} from '../helpers/url.utils';
import {PaginationInterceptor} from '../interceptors';
import {ExtendedPost} from '../interfaces';
import {ExtendCustomFilter, Post} from '../models';
import {PlatformPost} from '../models/platform-post.model';
import {PostService, SocialMediaService, TagService} from '../services';
// @authenticate("jwt")
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
              createdBy: {
                type: 'string',
              },
            },
          },
        },
      },
    })
    newPost: Omit<Post, 'id'>,
  ): Promise<Post> {
    return this.postService.postRepository.create(newPost);
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
    const originPostId = urlUtils.getOriginPostId();
    const username = urlUtils.getUsername();

    const newTags = platformPost.tags;
    const importer = platformPost.importer;

    const foundPost = await this.postService.postRepository.findOne({
      where: {originPostId, platform},
    });

    if (foundPost) {
      const importers = foundPost.importers.find(userId => userId === importer);

      if (importers) throw new HttpErrors.UnprocessableEntity('You have already import this post');

      foundPost.importers.push(importer);

      this.postService.postRepository.updateById(foundPost.id, {
        importers: foundPost.importers,
      }) as Promise<void>;

      return foundPost;
    }

    let newPost: ExtendedPost;
    let tags: string[] = newTags;

    switch (platform) {
      case PlatformType.TWITTER: {
        newPost = await this.socialMediaService.fetchTweet(originPostId);

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
        newPost = await this.socialMediaService.fetchRedditPost(originPostId);

        break;
      }

      case PlatformType.FACEBOOK: {
        if (!username) {
          throw new HttpErrors.UnprocessableEntity('Username not found!');
        }

        newPost = await this.socialMediaService.fetchFacebookPost(username, originPostId);

        break;
      }

      default:
        throw new HttpErrors.NotFound('Cannot found the specified url!');
    }

    newPost.tags = tags;
    newPost.importers = [importer];
    newPost.createdBy = importer;
    newPost.createdAt = new Date().toString();
    newPost.updatedAt = new Date().toString();

    this.tagService.createTags(newPost.tags) as Promise<void>;

    return this.postService.createPost(newPost);
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/posts', {
    responses: {
      '200': {
        description: 'Array of Post model instances',
        content: {
          'application/json': {
            schema: 'array',
            items: getModelSchemaRef(Post, {includeRelations: true}),
          },
        },
      },
    },
  })
  async timeline(
    @param.query.object('filter', getModelSchemaRef(ExtendCustomFilter, {exclude: ['q']}))
    filter: ExtendCustomFilter,
  ): Promise<Post[]> {
    return this.postService.postRepository.find(filter as Filter<Post>);
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
    updatedPost: Post,
  ): Promise<void> {
    await this.postService.postRepository.updateById(id, updatedPost);
  }

  @del('/posts/{id}')
  @response(204, {
    description: 'Post DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.postService.postRepository.deleteById(id);
  }
}

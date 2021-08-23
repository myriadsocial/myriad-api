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
import {PaginationInterceptor} from '../interceptors';
import {ValidatePostImportURL} from '../interceptors/validate-post-import-url.interceptor';
import {ExtendedPost} from '../interfaces';
import {MyriadPost, Post} from '../models';
import {PlatformPost} from '../models/platform-post.model';
import {PostService, SocialMediaService} from '../services';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class PostController {
  constructor(
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
          schema: getModelSchemaRef(MyriadPost),
        },
      },
    })
    newPost: MyriadPost,
  ): Promise<Post> {
    return this.postService.postRepository.create(new MyriadPost(newPost));
  }

  @intercept(ValidatePostImportURL.BINDING_KEY)
  @post('/posts/import')
  @response(200, {
    description: 'Post',
    content: {'application/json': {schema: getModelSchemaRef(Post)}},
  })
  async import(
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
    const [platform, originPostId, username] = platformPost.url.split(',');

    const newTags = platformPost.tags ? platformPost.tags : [];
    const importer = platformPost.importer;

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
  async getTimeline(
    @param.filter(Post, {exclude: ['limit', 'skip', 'offset']}) filter?: Filter<Post>,
  ): Promise<Post[]> {
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

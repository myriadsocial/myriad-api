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
import {PlatformType, VisibilityType} from '../enums';
import {
  AuthorizeInterceptor,
  CreateInterceptor,
  DeleteInterceptor,
  FindByIdInterceptor,
  PaginationInterceptor,
  UpdateInterceptor,
} from '../interceptors';
import {ValidatePostImportURL} from '../interceptors/validate-post-import-url.interceptor';
import {ExtendedPost} from '../interfaces';
import {DraftPost, Post, User} from '../models';
import {PlatformPost} from '../models/platform-post.model';
import {PostService, SocialMediaService} from '../services';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
@intercept(AuthorizeInterceptor.BINDING_KEY)
export class PostController {
  constructor(
    @service(SocialMediaService)
    protected socialMediaService: SocialMediaService,
    @service(PostService)
    protected postService: PostService,
  ) {}

  @intercept(CreateInterceptor.BINDING_KEY)
  @post('/posts')
  @response(200, {
    description: 'Post model instance',
    content: {'application/json': {schema: getModelSchemaRef(Post)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(DraftPost),
        },
      },
    })
    draftPost: DraftPost,
  ): Promise<DraftPost> {
    return this.postService.createDraftPost(draftPost);
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
    let newPost = await this.postService.findImportedPost(platformPost);

    if (!newPost) {
      newPost = await this.getSocialMediaPost(platformPost);
    }

    newPost.visibility = platformPost.visibility ?? VisibilityType.PUBLIC;
    newPost.tags = this.getImportedTags(newPost.tags, platformPost.tags ?? []);
    newPost.createdBy = platformPost.importer;
    newPost.isNSFW = Boolean(platformPost.NSFWTag);
    newPost.NSFWTag = platformPost.NSFWTag;
    newPost.popularCount = 0;

    return this.postService.createPost(newPost);
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
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
  async getTimeline(
    @param.filter(Post, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<Post>,
  ): Promise<Post[]> {
    return this.postService.postRepository.find(filter);
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/posts/{originPostId}/importers/{platform}')
  @response(200, {
    description: 'Array of Importer model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(User),
        },
      },
    },
  })
  async getImporters(
    @param.filter(Post, {
      exclude: ['limit', 'skip', 'offset', 'where', 'include'],
    })
    filter?: Filter<Post>,
  ): Promise<Post[]> {
    return this.postService.postRepository.find(filter);
  }

  @intercept(FindByIdInterceptor.BINDING_KEY)
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

  @intercept(UpdateInterceptor.BINDING_KEY)
  @patch('/posts/{id}')
  @response(204, {
    description: 'Post PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Post, {
            partial: true,
            exclude: [
              'id',
              'metric',
              'embeddedURL',
              'deletedAt',
              'createdBy',
              'peopleId',
              'totalImporter',
              'popularCount',
              'originCreatedAt',
              'url',
              'originPostId',
              'platform',
              'title',
              'asset',
              'createdAt',
            ],
          }),
        },
      },
    })
    updatedPost: Post,
  ): Promise<void> {
    await this.postService.postRepository.updateById(id, updatedPost);
  }

  @intercept(DeleteInterceptor.BINDING_KEY)
  @del('/posts/{id}')
  @response(204, {
    description: 'Post DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.postService.postRepository.deleteById(id);
  }

  async getSocialMediaPost(platformPost: PlatformPost): Promise<ExtendedPost> {
    const [platform, originPostId] = platformPost.url.split(',');

    switch (platform) {
      case PlatformType.TWITTER:
        return this.socialMediaService.fetchTweet(originPostId);

      case PlatformType.REDDIT:
        return this.socialMediaService.fetchRedditPost(originPostId);

      default:
        throw new HttpErrors.NotFound('Cannot find the platform!');
    }
  }

  getImportedTags(socialTags: string[], importedTags: string[]): string[] {
    if (!socialTags) socialTags = [];
    if (!importedTags) importedTags = [];

    const postTags = socialTags
      .filter((tag: string) => {
        return !importedTags
          .map((newTag: string) => newTag.toLowerCase())
          .includes(tag.toLowerCase());
      })
      .map((tag: string) => tag.toLowerCase());

    return [...socialTags, ...postTags];
  }
}

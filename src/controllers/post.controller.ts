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
  CreateInterceptor,
  DeletedDocument,
  DeleteInterceptor,
  PaginationInterceptor,
  RestrictedPostInterceptor,
  UpdateInterceptor,
} from '../interceptors';
import {ValidatePostImportURL} from '../interceptors/validate-post-import-url.interceptor';
import {ExtendedPost} from '../interfaces';
import {DraftPost, People, Post, PostWithRelations, User} from '../models';
import {PlatformPost} from '../models/platform-post.model';
import {PostService, SocialMediaService} from '../services';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
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

  @intercept(CreateInterceptor.BINDING_KEY)
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

    const posts = await this.postService.postRepository.find({
      where: {
        or: [
          {
            originPostId,
            platform: platform as PlatformType,
          },
          {
            originPostId,
            platform: platform as PlatformType,
            createdBy: importer,
          },
          /* eslint-disable  @typescript-eslint/no-explicit-any */
          <any>{
            originPostId,
            platform: platform as PlatformType,
            deletedAt: {
              $exists: true,
            },
          },
        ],
      },
      include: ['people'],
      limit: 5,
    });

    const hasBeenDeleted = posts.find(e => e.deletedAt);

    if (hasBeenDeleted) {
      throw new HttpErrors.UnprocessableEntity(
        'You cannot import deleted post',
      );
    }

    let newPost: ExtendedPost;
    let tags: string[] = newTags;

    if (!posts.length) {
      switch (platform) {
        case PlatformType.TWITTER:
          newPost = await this.socialMediaService.fetchTweet(originPostId);
          break;

        case PlatformType.REDDIT:
          newPost = await this.socialMediaService.fetchRedditPost(originPostId);
          break;

        case PlatformType.FACEBOOK:
          newPost = await this.socialMediaService.fetchFacebookPost(
            username,
            originPostId,
          );
          break;

        default:
          throw new HttpErrors.NotFound('Cannot find the platform!');
      }
    } else {
      const found = posts.find(e => e.createdBy === importer);

      if (found) {
        throw new HttpErrors.UnprocessableEntity(
          'You have already import this post',
        );
      }

      const existingPost: Partial<PostWithRelations> = posts[0];
      const platformUser: Partial<People> | undefined = existingPost.people;

      delete existingPost.id;
      delete existingPost.people;
      delete platformUser?.id;

      newPost = Object.assign(existingPost as ExtendedPost, {
        platformUser: platformUser,
      });
    }

    if (newPost.tags && newPost.tags.length > 0) {
      const postTags = newPost.tags
        .filter((tag: string) => {
          return !newTags
            .map((newTag: string) => newTag.toLowerCase())
            .includes(tag.toLowerCase());
        })
        .map(tag => tag.toLowerCase());

      tags = [...tags, ...postTags];
    }

    newPost.visibility = platformPost.visibility ?? VisibilityType.PUBLIC;
    newPost.tags = tags;
    newPost.createdBy = importer;
    newPost.isNSFW = Boolean(platformPost.NSFWTag);
    newPost.NSFWTag = platformPost.NSFWTag;

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

  @intercept(DeletedDocument.BINDING_KEY)
  @intercept(RestrictedPostInterceptor.BINDING_KEY)
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
    await this.postService.deletePost(id);
  }
}

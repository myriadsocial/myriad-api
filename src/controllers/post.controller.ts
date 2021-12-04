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
  DeletedDocument,
  PaginationInterceptor,
  RestrictedPostInterceptor,
} from '../interceptors';
import {ValidatePostImportURL} from '../interceptors/validate-post-import-url.interceptor';
import {ExtendedPost} from '../interfaces';
import {People, Post, PostWithRelations, User} from '../models';
import {PlatformPost} from '../models/platform-post.model';
import {
  NotificationService,
  PostService,
  SocialMediaService,
} from '../services';
import {UrlUtils} from '../utils/url.utils';
// import {authenticate} from '@loopback/authentication';

const urlUtils = new UrlUtils();
const {validateURL, getOpenGraph} = urlUtils;

// @authenticate("jwt")
export class PostController {
  constructor(
    @service(SocialMediaService)
    protected socialMediaService: SocialMediaService,
    @service(PostService)
    protected postService: PostService,
    @service(NotificationService)
    protected notificationService: NotificationService,
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
          schema: getModelSchemaRef(Post, {
            exclude: ['importers', 'totalImporter'],
          }),
        },
      },
    })
    newPost: Post,
  ): Promise<Post> {
    if (!newPost.text)
      throw new HttpErrors.UnprocessableEntity('Text field cannot be empty!');

    let url = '';
    let embeddedURL = null;

    const found = newPost.text.match(/https:\/\/|http:\/\/|www./g);
    if (found) {
      const index: number = newPost.text.indexOf(found[0]);

      for (let i = index; i < newPost.text.length; i++) {
        const letter = newPost.text[i];

        if (letter === ' ' || letter === '"') break;
        url += letter;
      }
    }

    try {
      if (url) validateURL(url);
      embeddedURL = await getOpenGraph(url);
    } catch {
      // ignore
    }

    if (embeddedURL) {
      newPost.embeddedURL = embeddedURL;
    }

    newPost.tags = newPost.tags.map(tag => tag.toLowerCase());

    const result = await this.postService.postRepository.create(newPost);

    try {
      await this.notificationService.sendMention(
        result.createdBy,
        result.id,
        result.mentions ?? [],
      );
    } catch {
      // ignore
    }

    return result;
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
        ],
      },
      include: ['people'],
      limit: 5,
    });

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
            exclude: ['deletedAt'],
          }),
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
    await this.postService.deletePost(id);
  }
}

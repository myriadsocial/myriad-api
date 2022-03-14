import {intercept, service} from '@loopback/core';
import {Filter, FilterExcludingWhere} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {
  CreateInterceptor,
  DeleteInterceptor,
  FindByIdInterceptor,
  PaginationInterceptor,
  UpdateInterceptor,
} from '../interceptors';
import {ValidatePostImportURL} from '../interceptors/validate-post-import-url.interceptor';
import {DraftPost, Post, User} from '../models';
import {PlatformPost} from '../models/platform-post.model';
import {PostService} from '../services';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
export class PostController {
  constructor(
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
          schema: getModelSchemaRef(PlatformPost, {
            exclude: ['rawPost'],
          }),
        },
      },
    })
    platformPost: PlatformPost,
  ): Promise<Post> {
    return this.postService.createPost(platformPost.rawPost);
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
    @param.path.string('originPostId') originPostId: string,
    @param.path.string('platform') platform: string,
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
              'banned',
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
              'experienceIndex',
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
}

import {authenticate} from '@loopback/authentication';
import {intercept, service} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
} from '@loopback/repository';
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
import {FindByIdInterceptor, PaginationInterceptor} from '../../interceptors';
import {
  CreateImportedPostDto,
  DraftPost,
  Post,
  UpdatePostDto,
} from '../../models';
import {UserService} from '../../services';
import {PlatformType} from '../../enums';

@authenticate('jwt')
export class UserPostController {
  constructor(
    @service(UserService)
    private userService: UserService,
  ) {}

  @get('/user/draft')
  @response(200, {
    description: 'GET user draft-post',
    content: {
      'application/json': {
        schema: getModelSchemaRef(DraftPost, {includeRelations: true}),
      },
    },
  })
  async draftPost(): Promise<DraftPost | null> {
    return this.userService.draftPost();
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/user/posts')
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
    @param.filter(Post, {exclude: ['limit', 'skip', 'offset', 'where']})
    filter?: Filter<Post>,
  ): Promise<Post[]> {
    const newinclusion = filter
      ? filter.include?.map(incl => {
          if (typeof incl !== 'string') {
            if (incl.relation === 'user') {
              incl = {
                relation: 'user',
                scope: {
                  fields: {email: false},
                  include: [
                    {
                      relation: 'wallets',
                    },
                  ],
                },
              };
              return incl;
            } else {
              return incl;
            }
          } else {
            if (incl === 'user') {
              incl = {
                relation: 'user',
                scope: {
                  fields: {email: false},
                  include: [
                    {
                      relation: 'wallets',
                    },
                  ],
                },
              };
              return incl;
            } else {
              return incl;
            }
          }
        })
      : undefined;
    filter!.include = newinclusion;
    return this.userService.posts(filter);
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/user/profile/{id}/posts')
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
  async findByProfile(
    @param.path.string('id') id: string,
    @param.filter(Post, {exclude: ['limit', 'skip', 'offset', 'where']})
    filter?: Filter<Post>,
  ): Promise<Post[]> {
    return this.userService.profilePosts(id, filter);
  }

  @intercept(FindByIdInterceptor.BINDING_KEY)
  @get('/user/posts/{id}')
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
    @param.query.string('platform') platform?: PlatformType,
  ): Promise<Post> {
    return this.userService.post(id, filter, platform);
  }

  @get('/user/posts/action')
  @response(200, {
    description: 'Action COUNT left',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(): Promise<Count | undefined> {
    return this.userService.actionCount();
  }

  @post('/user/posts')
  @response(200, {
    description: 'CREATE user post',
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
  ): Promise<Post | DraftPost> {
    return this.userService.createPost(draftPost);
  }

  @post('/user/posts/import')
  @response(200, {
    description: 'Post',
    content: {'application/json': {schema: getModelSchemaRef(Post)}},
  })
  async import(
    @requestBody({
      description: 'IMPORT user post',
      content: {
        'application/json': {
          schema: getModelSchemaRef(CreateImportedPostDto),
        },
      },
    })
    createImportedPostDto: CreateImportedPostDto,
  ): Promise<Post> {
    return this.userService.importPost(createImportedPostDto);
  }

  @patch('/user/posts/{id}')
  @response(200, {
    description: 'Post PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UpdatePostDto),
        },
      },
    })
    data: UpdatePostDto,
  ): Promise<Count> {
    return this.userService.updatePost(id, data);
  }

  @del('/user/posts/{id}')
  @response(200, {
    description: 'Post DELETE success',
  })
  async deleteById(
    @param.path.string('id') id: string,
    @param.query.object('post') _post?: Post,
  ): Promise<Count> {
    return this.userService.removePost(id, _post);
  }
}

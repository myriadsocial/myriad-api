import {authenticate} from '@loopback/authentication';
import {intercept, service} from '@loopback/core';
import {Filter} from '@loopback/repository';
import {get, getModelSchemaRef, param, response} from '@loopback/rest';
import {PaginationInterceptor} from '../../interceptors';
import {Post, User} from '../../models';
import {PostService} from '../../services';

@authenticate('jwt')
export class PostController {
  constructor(
    @service(PostService)
    private postService: PostService,
  ) {}

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
    @param.path.string('originPostId') _originPostId: string,
    @param.path.string('platform') _platform: string,
    @param.filter(Post, {
      exclude: ['limit', 'skip', 'offset', 'where', 'include'],
    })
    filter?: Filter<Post>,
  ): Promise<Post[]> {
    return this.postService.find(filter);
  }
}

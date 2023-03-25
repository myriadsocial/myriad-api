import {authenticate} from '@loopback/authentication';
import {intercept, service} from '@loopback/core';
import {Filter} from '@loopback/repository';
import {get, getModelSchemaRef, param} from '@loopback/rest';
import {PaginationInterceptor} from '../../interceptors';
import {Experience} from '../../models';
import {PostService} from '../../services';

@authenticate('jwt')
export class PostExperienceController {
  constructor(
    @service(PostService)
    private postService: PostService,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/posts/{id}/experiences', {
    responses: {
      '200': {
        description: 'Array of Post has many Experience through ExperiencePost',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Experience)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Experience>,
  ): Promise<Experience[]> {
    return this.postService.experiences(id, filter);
  }
}

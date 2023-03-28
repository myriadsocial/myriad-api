import {authenticate} from '@loopback/authentication';
import {intercept, service} from '@loopback/core';
import {Count, CountSchema, Filter} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  post,
  requestBody,
} from '@loopback/rest';
import {PaginationInterceptor} from '../../interceptors';
import {CreateExperiencePostDto, ExperiencePost, Post} from '../../models';
import {ExperienceService} from '../../services';

@authenticate('jwt')
export class ExperiencePostController {
  constructor(
    @service(ExperienceService)
    private experienceService: ExperienceService,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/experience/{id}/posts', {
    responses: {
      '200': {
        description: 'GET experience posts',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(Post, {
                includeRelations: true,
              }),
            },
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.filter(Post, {exclude: ['limit', 'skip', 'offset', 'where']})
    filter?: Filter<Post>,
  ): Promise<Post[]> {
    return this.experienceService.posts(id, filter);
  }

  @post('/experiences/post', {
    responses: {
      '200': {
        description: 'CREATE experience post',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(ExperiencePost),
            },
          },
        },
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(CreateExperiencePostDto),
        },
      },
    })
    data: CreateExperiencePostDto,
  ): Promise<ExperiencePost[]> {
    return this.experienceService.addPost(data);
  }

  @del('/experience/{experienceId}/post/{postId}', {
    responses: {
      '200': {
        description: 'Delete Experience Post model instance',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('experienceId') experienceId: string,
    @param.path.string('postId') postId: string,
  ): Promise<Count> {
    return this.experienceService.substractPost(experienceId, postId);
  }
}

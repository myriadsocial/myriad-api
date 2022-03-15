import {authenticate} from '@loopback/authentication';
import {intercept} from '@loopback/core';
import {Count, CountSchema, Filter, repository} from '@loopback/repository';
import {del, get, getModelSchemaRef, param, post} from '@loopback/rest';
import {
  CreateInterceptor,
  DeleteInterceptor,
  PaginationInterceptor,
} from '../interceptors';
import {ExperiencePost, Post} from '../models';
import {ExperiencePostRepository, ExperienceRepository} from '../repositories';

@authenticate('jwt')
export class ExperiencePostController {
  constructor(
    @repository(ExperienceRepository)
    protected experienceRepository: ExperienceRepository,
    @repository(ExperiencePostRepository)
    protected experiencePostRepository: ExperiencePostRepository,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/experiences/{id}/posts', {
    responses: {
      '200': {
        description: 'Array of Post model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(ExperiencePost, {
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
    return this.experienceRepository.posts(id).find(filter);
  }

  @intercept(CreateInterceptor.BINDING_KEY)
  @post('/experiences/{experienceId}/posts/{postId}', {
    responses: {
      '200': {
        description: 'create a ExperiencePost model instance',
        content: {
          'application/json': {schema: getModelSchemaRef(ExperiencePost)},
        },
      },
    },
  })
  async create(
    @param.path.string('experienceId') experienceId: string,
    @param.path.string('postId') postId: string,
  ): Promise<ExperiencePost> {
    return this.experiencePostRepository.create({postId, experienceId});
  }

  @intercept(DeleteInterceptor.BINDING_KEY)
  @del('/experiences/{experienceId}/posts/{postId}', {
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
    return this.experiencePostRepository.deleteAll({postId, experienceId});
  }
}

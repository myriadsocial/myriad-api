import {intercept} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import {PaginationInterceptor} from '../interceptors';
import {Post, Experience} from '../models';
import {PostRepository} from '../repositories';

export class PostExperienceController {
  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
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
    return this.postRepository.experiences(id).find(filter);
  }

  @post('/posts/{id}/experiences', {
    responses: {
      '200': {
        description: 'create a Experience model instance',
        content: {'application/json': {schema: getModelSchemaRef(Experience)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Post.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Experience, {
            title: 'NewExperienceInPost',
            exclude: ['id'],
          }),
        },
      },
    })
    experience: Omit<Experience, 'id'>,
  ): Promise<Experience> {
    return this.postRepository.experiences(id).create(experience);
  }

  @patch('/posts/{id}/experiences', {
    responses: {
      '200': {
        description: 'Post.Experience PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Experience, {partial: true}),
        },
      },
    })
    experience: Partial<Experience>,
    @param.query.object('where', getWhereSchemaFor(Experience))
    where?: Where<Experience>,
  ): Promise<Count> {
    return this.postRepository.experiences(id).patch(experience, where);
  }

  @del('/posts/{id}/experiences', {
    responses: {
      '200': {
        description: 'Post.Experience DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Experience))
    where?: Where<Experience>,
  ): Promise<Count> {
    return this.postRepository.experiences(id).delete(where);
  }
}

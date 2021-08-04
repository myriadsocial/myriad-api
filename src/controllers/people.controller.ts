import {intercept} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
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
import {defaultFilterQuery} from '../helpers/filter-utils';
import {PaginationInterceptor} from '../interceptors';
import {People, Post} from '../models';
import {PeopleRepository} from '../repositories';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")

@intercept(PaginationInterceptor.BINDING_KEY)
export class PeopleController {
  constructor(
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
  ) {}

  @post('/people')
  @response(200, {
    description: 'People model instance',
    content: {'application/json': {schema: getModelSchemaRef(People)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(People, {
            title: 'NewPeople',
          }),
        },
      },
    })
    people: People,
  ): Promise<People> {
    return this.peopleRepository.create(people);
  }

  @get('/people')
  @response(200, {
    description: 'Array of People model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(People, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.query.number('page') page: number,
    @param.filter(People, {exclude: ['skip', 'offset']}) filter?: Filter<People>,
  ): Promise<People[]> {
    filter = defaultFilterQuery(page, filter);
    return this.peopleRepository.find(filter);
  }

  @get('/people/{id}')
  @response(200, {
    description: 'People model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(People, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(People, {exclude: 'where'})
    filter?: FilterExcludingWhere<People>,
  ): Promise<People> {
    return this.peopleRepository.findById(id, filter);
  }

  @get('/people/{id}/posts', {
    responses: {
      '200': {
        description: 'Array of People has many Post',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Post)},
          },
        },
      },
    },
  })
  async findPeoplePost(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Post>,
  ): Promise<Post[]> {
    return this.peopleRepository.posts(id).find(filter);
  }

  @patch('/people/{id}')
  @response(204, {
    description: 'People PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(People, {partial: true}),
        },
      },
    })
    people: People,
  ): Promise<void> {
    await this.peopleRepository.updateById(id, people);
  }

  @del('/people/{id}')
  @response(204, {
    description: 'People DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.peopleRepository.deleteById(id);
  }
}

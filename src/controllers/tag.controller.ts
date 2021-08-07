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
import {PaginationInterceptor} from '../interceptors';
import {CustomFilter, Tag} from '../models';
import {TagRepository} from '../repositories';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class TagController {
  constructor(
    @repository(TagRepository)
    protected tagRepository: TagRepository,
  ) {}

  @post('/tags')
  @response(200, {
    description: 'Tag model instance',
    content: {'application/json': {schema: getModelSchemaRef(Tag)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Tag, {
            title: 'NewTag',
          }),
        },
      },
    })
    tag: Tag,
  ): Promise<Tag> {
    return this.tagRepository.create(tag);
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/tags')
  @response(200, {
    description: 'Array of Tag model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Tag, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.query.object('filter', getModelSchemaRef(CustomFilter)) filter: CustomFilter,
  ): Promise<Tag[]> {
    return this.tagRepository.find(filter as Filter<Tag>);
  }

  @get('/tags/{id}')
  @response(200, {
    description: 'Tag model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Tag, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Tag, {exclude: 'where'}) filter?: FilterExcludingWhere<Tag>,
  ): Promise<Tag> {
    return this.tagRepository.findById(id, filter);
  }

  @patch('/tags/{id}')
  @response(204, {
    description: 'Tag PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Tag, {partial: true}),
        },
      },
    })
    tag: Tag,
  ): Promise<void> {
    await this.tagRepository.updateById(id, tag);
  }

  @del('/tags/{id}')
  @response(204, {
    description: 'Tag DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.tagRepository.deleteById(id);
  }
}

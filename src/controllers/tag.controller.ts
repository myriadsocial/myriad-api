import {intercept} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {
  get,
  getModelSchemaRef,
  param,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {CreateInterceptor, PaginationInterceptor} from '../interceptors';
import {Tag} from '../models';
import {TagRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';
import {PermissionKeys} from '../enums';

@authenticate({strategy: 'jwt', options: {required: [PermissionKeys.ADMIN]}})
export class TagController {
  constructor(
    @repository(TagRepository)
    protected tagRepository: TagRepository,
  ) {}

  @intercept(CreateInterceptor.BINDING_KEY)
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
            exclude: ['count'],
          }),
        },
      },
    })
    tag: Tag,
  ): Promise<Tag> {
    return this.tagRepository.create(tag);
  }

  @authenticate.skip()
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
    @param.filter(Tag, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<Tag>,
  ): Promise<Tag[]> {
    return this.tagRepository.find(filter);
  }

  @authenticate.skip()
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
}

import {authenticate} from '@loopback/authentication';
import {intercept, service} from '@loopback/core';
import {Filter} from '@loopback/repository';
import {get, getModelSchemaRef, param, response} from '@loopback/rest';
import {PaginationInterceptor} from '../interceptors';
import {Tag} from '../models';
import {TagService} from '../services';

@authenticate('jwt')
export class TagController {
  constructor(
    @service(TagService)
    protected tagService: TagService,
  ) {}

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
    return this.tagService.find(filter);
  }
}

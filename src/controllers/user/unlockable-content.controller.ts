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
import {PaginationInterceptor} from '../../interceptors';
import {UnlockableContent, UnlockableContentWithPrice} from '../../models';
import {UserService} from '../../services';

@authenticate('jwt')
export class UserUnlockableContentController {
  constructor(
    @service(UserService)
    private userService: UserService,
  ) {}

  @post('/user/unlockable-contents')
  @response(200, {
    description: 'CREATE user unlockable-content',
    'application/json': {
      schema: getModelSchemaRef(UnlockableContentWithPrice),
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UnlockableContentWithPrice, {
            title: 'NewUnlockableContent',
            exclude: ['id'],
          }),
        },
      },
    })
    content: Omit<UnlockableContentWithPrice, 'id'>,
  ): Promise<UnlockableContent> {
    return this.userService.createUnlockableContent(content);
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/user/unlockable-contents')
  @response(200, {
    description: 'Array of UnlockableContent model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(UnlockableContent, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(UnlockableContent, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<UnlockableContent>,
  ): Promise<UnlockableContent[]> {
    return this.userService.unlockableContents(filter);
  }

  @get('/user/unlockable-contents/{id}')
  @response(200, {
    description: 'GET user unlockable-content',
    'application/json': {
      schema: getModelSchemaRef(UnlockableContent, {includeRelations: true}),
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(UnlockableContent, {exclude: 'where'})
    filter?: FilterExcludingWhere<UnlockableContent>,
  ): Promise<UnlockableContent> {
    return this.userService.unlockableContent(id, filter);
  }

  @patch('/user/unlockable-contents/{id}')
  @response(204, {
    description: 'UPDATE user unlockable-content',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UnlockableContent, {
            partial: true,
          }),
        },
      },
    })
    content: Partial<UnlockableContent>,
  ): Promise<Count> {
    return this.userService.updateUnlockableContent(id, content);
  }

  @del('/user/unlockable-contents/{id}')
  @response(204, {
    description: 'REMOVE user unlockable-content',
    content: {'application/json': {schema: CountSchema}},
  })
  async deleteById(@param.path.string('id') id: string) {
    return this.userService.removeUnlockableContent(id);
  }
}

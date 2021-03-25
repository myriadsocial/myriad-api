import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  response,
} from '@loopback/rest';
import {Content} from '../models';
import {ContentRepository} from '../repositories';

export class ContentController {
  constructor(
    @repository(ContentRepository)
    public contentRepository : ContentRepository,
  ) {}

  @post('/contents')
  @response(200, {
    description: 'Content model instance',
    content: {'application/json': {schema: getModelSchemaRef(Content)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Content, {
            title: 'NewContent',
            exclude: ['id'],
          }),
        },
      },
    })
    content: Omit<Content, 'id'>,
  ): Promise<Content> {
    return this.contentRepository.create(content);
  }

  @get('/contents/count')
  @response(200, {
    description: 'Content model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Content) where?: Where<Content>,
  ): Promise<Count> {
    return this.contentRepository.count(where);
  }

  @get('/contents')
  @response(200, {
    description: 'Array of Content model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Content, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Content) filter?: Filter<Content>,
  ): Promise<Content[]> {
    return this.contentRepository.find(filter);
  }

  @patch('/contents')
  @response(200, {
    description: 'Content PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Content, {partial: true}),
        },
      },
    })
    content: Content,
    @param.where(Content) where?: Where<Content>,
  ): Promise<Count> {
    return this.contentRepository.updateAll(content, where);
  }

  @get('/contents/{id}')
  @response(200, {
    description: 'Content model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Content, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Content, {exclude: 'where'}) filter?: FilterExcludingWhere<Content>
  ): Promise<Content> {
    return this.contentRepository.findById(id, filter);
  }

  @patch('/contents/{id}')
  @response(204, {
    description: 'Content PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Content, {partial: true}),
        },
      },
    })
    content: Content,
  ): Promise<void> {
    await this.contentRepository.updateById(id, content);
  }

  @put('/contents/{id}')
  @response(204, {
    description: 'Content PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() content: Content,
  ): Promise<void> {
    await this.contentRepository.replaceById(id, content);
  }

  @del('/contents/{id}')
  @response(204, {
    description: 'Content DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.contentRepository.deleteById(id);
  }
}

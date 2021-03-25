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
import {Topic} from '../models';
import {TopicRepository} from '../repositories';

export class TopicController {
  constructor(
    @repository(TopicRepository)
    public topicRepository : TopicRepository,
  ) {}

  @post('/topics')
  @response(200, {
    description: 'Topic model instance',
    content: {'application/json': {schema: getModelSchemaRef(Topic)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Topic, {
            title: 'NewTopic',
            exclude: ['id'],
          }),
        },
      },
    })
    topic: Omit<Topic, 'id'>,
  ): Promise<Topic> {
    return this.topicRepository.create(topic);
  }

  @get('/topics/count')
  @response(200, {
    description: 'Topic model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Topic) where?: Where<Topic>,
  ): Promise<Count> {
    return this.topicRepository.count(where);
  }

  @get('/topics')
  @response(200, {
    description: 'Array of Topic model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Topic, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Topic) filter?: Filter<Topic>,
  ): Promise<Topic[]> {
    return this.topicRepository.find(filter);
  }

  @patch('/topics')
  @response(200, {
    description: 'Topic PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Topic, {partial: true}),
        },
      },
    })
    topic: Topic,
    @param.where(Topic) where?: Where<Topic>,
  ): Promise<Count> {
    return this.topicRepository.updateAll(topic, where);
  }

  @get('/topics/{id}')
  @response(200, {
    description: 'Topic model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Topic, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Topic, {exclude: 'where'}) filter?: FilterExcludingWhere<Topic>
  ): Promise<Topic> {
    return this.topicRepository.findById(id, filter);
  }

  @patch('/topics/{id}')
  @response(204, {
    description: 'Topic PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Topic, {partial: true}),
        },
      },
    })
    topic: Topic,
  ): Promise<void> {
    await this.topicRepository.updateById(id, topic);
  }

  @put('/topics/{id}')
  @response(204, {
    description: 'Topic PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() topic: Topic,
  ): Promise<void> {
    await this.topicRepository.replaceById(id, topic);
  }

  @del('/topics/{id}')
  @response(204, {
    description: 'Topic DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.topicRepository.deleteById(id);
  }
}

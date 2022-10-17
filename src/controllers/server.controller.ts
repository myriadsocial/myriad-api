import {authenticate} from '@loopback/authentication';
import {
  post,
  get,
  getModelSchemaRef,
  patch,
  requestBody,
  response,
  param,
} from '@loopback/rest';
import {PermissionKeys} from '../enums';
import {Server} from '../models';
import {ServerService} from '../services';
import {service} from '@loopback/core';

@authenticate({strategy: 'jwt', options: {required: [PermissionKeys.ADMIN]}})
export class ServerController {
  constructor(
    @service(ServerService)
    public serverService: ServerService,
  ) {}

  @authenticate.skip()
  @get('/server', {
    responses: {
      200: {
        description: 'Server model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Server, {includeRelations: true}),
          },
        },
      },
    },
  })
  async find(
    @param.query.boolean('median') median?: boolean,
    @param.query.boolean('average') average?: boolean,
  ): Promise<Server> {
    return this.serverService.find(median, average);
  }

  @post('/server')
  @response(200, {
    description: 'Server model instance',
    content: {'application/json': {schema: getModelSchemaRef(Server)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Server, {
            title: 'NewServer',
            exclude: ['id', 'metric', 'median'],
          }),
        },
      },
    })
    server: Omit<Server, 'id'>,
  ): Promise<Server> {
    return this.serverService.create(server);
  }

  @patch('/server')
  @response(204, {
    description: 'Server PATCH success',
  })
  async update(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Server, {
            partial: true,
            exclude: ['id', 'metric', 'median', 'average'],
          }),
        },
      },
    })
    server: Partial<Server>,
  ): Promise<void> {
    return this.serverService.update(server);
  }
}

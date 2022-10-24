import {authenticate} from '@loopback/authentication';
import {service} from '@loopback/core';
import {
  get,
  getModelSchemaRef,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {PermissionKeys} from '../../enums';
import {Server} from '../../models';
import {AdminService} from '../../services';

@authenticate({strategy: 'jwt', options: {required: [PermissionKeys.ADMIN]}})
export class ServerController {
  constructor(
    @service(AdminService)
    private adminService: AdminService,
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
  async find(): Promise<Server> {
    return this.adminService.server();
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
    return this.adminService.registerServer(server);
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
    return this.adminService.updateServer(server);
  }
}

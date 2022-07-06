import {authenticate} from '@loopback/authentication';
import {AnyObject, repository} from '@loopback/repository';
import {
  post,
  get,
  getModelSchemaRef,
  patch,
  del,
  requestBody,
  response,
  HttpErrors,
} from '@loopback/rest';
import {config} from '../config';
import {PermissionKeys} from '../enums';
import {Server} from '../models';
import {ServerRepository} from '../repositories';

@authenticate({strategy: 'jwt', options: {required: [PermissionKeys.ADMIN]}})
export class ServerController {
  constructor(
    @repository(ServerRepository)
    public serverRepository: ServerRepository,
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
  async find(): Promise<AnyObject> {
    return this.serverRepository.findById(config.MYRIAD_SERVER_ID);
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
            exclude: ['id', 'metric'],
          }),
        },
      },
    })
    server: Omit<Server, 'id'>,
  ): Promise<Server> {
    const exists = await this.serverRepository.exists(config.MYRIAD_SERVER_ID);

    if (exists)
      throw new HttpErrors.UnprocessableEntity('Server already exists');

    return this.serverRepository.create(
      Object.assign(server, {
        id: config.MYRIAD_SERVER_ID,
      }),
    );
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
            exclude: ['id', 'metric'],
          }),
        },
      },
    })
    server: Partial<Server>,
  ): Promise<void> {
    if (server.accountId) {
      const oldServer = await this.serverRepository.findById(
        config.MYRIAD_SERVER_ID,
      );
      server.accountId = {...oldServer.accountId, ...server.accountId};
    }

    await this.serverRepository.updateById(config.MYRIAD_SERVER_ID, server);
  }

  @del('/server')
  @response(204, {
    description: 'Server DELETE success',
  })
  async delete(): Promise<void> {
    await this.serverRepository.deleteById(config.MYRIAD_SERVER_ID);
  }
}

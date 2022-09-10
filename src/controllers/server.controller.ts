import {authenticate} from '@loopback/authentication';
import {AnyObject, repository} from '@loopback/repository';
import {
  post,
  get,
  getModelSchemaRef,
  patch,
  requestBody,
  response,
  HttpErrors,
} from '@loopback/rest';
import {config} from '../config';
import {PermissionKeys} from '../enums';
import {Server} from '../models';
import {ServerRepository} from '../repositories';
import {PolkadotJs} from '../utils/polkadotJs-utils';

const {getKeyring} = new PolkadotJs();

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
  async find(): Promise<Server> {
    const server = await this.getServer();
    if (!server) throw new HttpErrors.NotFound('ServerNotFound');
    return server;
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
    const exists = await this.getServer();

    if (exists) {
      throw new HttpErrors.UnprocessableEntity('ServerExist');
    }

    return this.serverRepository.create(server);
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
    const currentServer = await this.getServer();

    if (!currentServer) {
      throw new HttpErrors.UnprocessableEntity('ServerNotExist');
    }

    const serverId = currentServer.id;

    if (server.accountId || server.images) {
      server.accountId = {...currentServer.accountId, ...server.accountId};
      server.images = {...currentServer.images, ...server.images};
    }

    return this.serverRepository.updateById(serverId, server);
  }

  async getServer(): Promise<Server | null> {
    const mnemonic = config.MYRIAD_ADMIN_MNEMONIC;

    if (!mnemonic) throw new HttpErrors.NotFound('MnemonicNotFound');

    const serverAdmin = getKeyring().addFromMnemonic(mnemonic);
    const address = serverAdmin.address;

    return this.serverRepository.findOne(<AnyObject>{
      where: {
        'accountId.myriad': address,
      },
    });
  }
}

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
  param,
} from '@loopback/rest';
import {config} from '../config';
import {PermissionKeys} from '../enums';
import {Server} from '../models';
import {ServerRepository, UserRepository} from '../repositories';
import {PolkadotJs} from '../utils/polkadotJs-utils';

const {getKeyring} = new PolkadotJs();

@authenticate({strategy: 'jwt', options: {required: [PermissionKeys.ADMIN]}})
export class ServerController {
  constructor(
    @repository(ServerRepository)
    public serverRepository: ServerRepository,
    @repository(UserRepository)
    public userRepository: UserRepository,
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
  async find(@param.query.boolean('median') median?: boolean): Promise<Server> {
    const server = await this.getServer();
    if (!server) throw new HttpErrors.NotFound('ServerNotFound');

    if (median) {
      const [
        userPost,
        userComment,
        userExperience,
        userTransaction,
        userSubscription,
      ] = await Promise.all([
        this.userRepository.find({
          order: ['metric.totalPosts ASC'],
          skip: Math.ceil(server.metric.totalPosts.totalAll / 2),
          limit: 1,
        }),
        this.userRepository.find({
          order: ['metric.totalComments ASC'],
          skip: Math.ceil(server.metric.totalComments / 2),
          limit: 1,
        }),
        this.userRepository.find({
          order: ['metric.totalExperiences ASC'],
          skip: Math.ceil(server.metric.totalExperiences / 2),
          limit: 1,
        }),
        this.userRepository.find({
          order: ['metric.totalTransactions ASC'],
          skip: Math.ceil(server.metric.totalTransactions / 2),
          limit: 1,
        }),
        this.userRepository.find({
          order: ['metric.totalSubscriptions ASC'],
          skip: Math.ceil(server.metric.totalSubscriptions / 2),
          limit: 1,
        }),
      ]);

      const medianPost = userPost?.[0]?.metric?.totalPosts ?? 0;
      const medianComment = userComment?.[0]?.metric?.totalComments ?? 0;
      const medianExperience =
        userExperience?.[0]?.metric?.totalExperiences ?? 0;
      const medianTransaction =
        userTransaction?.[0]?.metric?.totalTransactions ?? 0;
      const medianSubscription =
        userSubscription?.[0]?.metric?.totalSubscriptions ?? 0;

      Object.assign(server, {
        median: {
          medianPost,
          medianComment,
          medianExperience,
          medianTransaction,
          medianSubscription,
        },
      });
    }

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
            exclude: ['id', 'metric', 'median'],
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
            exclude: ['id', 'metric', 'median'],
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

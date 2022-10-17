import {BindingScope, injectable} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {config} from '../config';
import {Server, User} from '../models';
import {ServerRepository, UserRepository} from '../repositories';
import {PolkadotJs} from '../utils/polkadotJs-utils';
import {omit} from 'lodash';

const {getKeyring} = new PolkadotJs();

@injectable({scope: BindingScope.TRANSIENT})
export class ServerService {
  constructor(
    @repository(ServerRepository)
    private serverRepository: ServerRepository,
    @repository(UserRepository)
    private userRepository: UserRepository,
  ) {}

  public async find(median?: boolean, average?: boolean): Promise<Server> {
    const server = await this.getServer();
    if (!server) throw new HttpErrors.NotFound('ServerNotFound');

    if (median) await this.getMedian(server);
    if (average) await this.getAverage(server);

    return server;
  }

  public async create(server: Omit<Server, 'id'>): Promise<Server> {
    const exists = await this.getServer();

    if (exists) {
      throw new HttpErrors.UnprocessableEntity('ServerExist');
    }

    return this.serverRepository.create(server);
  }

  public async update(server: Partial<Server>): Promise<void> {
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

  private async getServer(): Promise<Server | null> {
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

  private async getMedian(server: Server) {
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
    const medianExperience = userExperience?.[0]?.metric?.totalExperiences ?? 0;
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

  private async getAverage(server: Server) {
    const userCollection = (
      this.userRepository.dataSource.connector as AnyObject
    ).collection(User.modelName);

    const result = await userCollection
      .aggregate([
        {
          $group: {
            _id: null,
            averagePost: {$avg: '$metric.totalPosts'},
            averageComment: {$avg: '$metric.totalComments'},
            averageExperience: {$avg: '$metric.totalExperiences'},
            averageTransaction: {$avg: '$metric.totalTransactions'},
            averageSubscription: {$avg: '$metric.totalSubscriptions'},
          },
        },
      ])
      .get();

    if (!result.length) return;
    const averageMetric = omit(result[0], '_id');

    Object.assign(server, {
      average: averageMetric,
    });
  }
}

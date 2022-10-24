import {BindingScope, injectable} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {config} from '../config';
import {Server} from '../models';
import {ServerRepository} from '../repositories';
import {PolkadotJs} from '../utils/polkadot-js';

const {getKeyring} = new PolkadotJs();

@injectable({scope: BindingScope.TRANSIENT})
export class ServerService {
  constructor(
    @repository(ServerRepository)
    private serverRepository: ServerRepository,
  ) {}

  public async find(): Promise<Server> {
    const server = await this.getServer();
    if (!server) throw new HttpErrors.NotFound('ServerNotFound');
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
}

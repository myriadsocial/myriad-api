import {BindingScope, injectable} from '@loopback/context';
import {PolkadotJs} from '../utils/polkadotJs-utils';
import {config} from '../config';
import {Currency} from '../models';
import {ApiPromise, WsProvider} from '@polkadot/api';
import myriadTypes from '../data-seed/myriad-types.json';

interface TxRecipe {
  currencyId: string;
  postId: string;
  peopleId: string;
  platform: string;
  amount: number;
}

const {getKeyring} = new PolkadotJs();

@injectable({scope: BindingScope.TRANSIENT})
export class MyriadNodeService {
  private mnemonic = config.MYRIAD_MNEMONIC;
  private signer = getKeyring().addFromMnemonic(this.mnemonic);

  async addNewCurrency(currency: Currency): Promise<void> {
    const {id: currencyId, decimal, rpcURL, native} = currency;
    const api = await this.connectMyriadNode();
    const tx = api.tx.currencies.addCurrency(
      currencyId,
      decimal,
      rpcURL,
      native,
    );

    await tx.signAndSend(this.signer);
    await api.disconnect();
  }

  async addNewPlatform(platform: string): Promise<void> {
    const api = await this.connectMyriadNode();
    const tx = api.tx.platform.addPlatform(platform);

    await tx.signAndSend(this.signer);
    await api.disconnect();
  }

  async sendTip(txRecipe: TxRecipe): Promise<void> {
    /* eslint-disable @typescript-eslint/naming-convention */
    const {
      postId: post_id,
      peopleId: people_id,
      platform,
      currencyId,
      amount,
    } = txRecipe;
    const api = await this.connectMyriadNode();
    const tx = api.tx.escrow.sendTip(
      currencyId,
      {post_id, people_id, platform},
      amount,
    );

    await tx.signAndSend(this.signer);
    await api.disconnect();
  }

  async connectMyriadNode(): Promise<ApiPromise> {
    const provider = new WsProvider(config.MYRIAD_WS_RPC, false);

    await provider.connect();

    return new ApiPromise({provider, types: myriadTypes}).isReadyOrError;
  }
}

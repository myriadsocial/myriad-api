import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {User, Wallet} from '../../models';
import {
  NetworkRepository,
  UserRepository,
  WalletRepository,
} from '../../repositories';
import {
  deleteAllRepository,
  givenAccesToken,
  givenAddress,
  givenCredential,
  givenNetworkInstance,
  givenNetworkRepository,
  givenUserInstance,
  givenUserRepository,
  givenWallet,
  givenWalletInstance,
  givenWalletRepository,
  setupApplication,
} from '../helpers';
import {u8aToHex, numberToHex} from '@polkadot/util';
import {KeyringPair} from '@polkadot/keyring/types';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('UserWalletApplication', function () {
  this.timeout(100000);

  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let userRepository: UserRepository;
  let walletRepository: WalletRepository;
  let networkRepository: NetworkRepository;
  let user: User;
  let defaultWallet: Wallet;
  let address: KeyringPair;

  before(async () => {
    ({app, client} = await setupApplication(true));
  });

  after(() => app.stop());

  before(async () => {
    userRepository = await givenUserRepository(app);
    networkRepository = await givenNetworkRepository(app);
    walletRepository = await givenWalletRepository(app);
  });

  before(async () => {
    address = givenAddress();
    user = await givenUserInstance(userRepository);
    token = await givenAccesToken(user);
  });

  beforeEach(async () => {
    await walletRepository.deleteAll();
    defaultWallet = await userRepository.wallets(user.id).create(
      givenWallet({
        id: 'abdulhakim.testnet',
        networkId: 'near',
        blockchainPlatform: 'near',
      }),
    );
  });

  after(async () => {
    await deleteAllRepository(app);
  });

  it('creates a wallet for user', async () => {
    const network = await givenNetworkInstance(networkRepository);
    const credential = givenCredential({
      nonce: user.nonce,
      signature: u8aToHex(address.sign(numberToHex(user.nonce))),
      networkType: network.id,
    });
    const wallet = new Wallet({
      id: credential.publicAddress,
    });
    credential.data = wallet;

    const response = await client
      .post(`/user/connect-wallet`)
      .set('Authorization', `Bearer ${token}`)
      .send(credential)
      .expect(200);

    expect(response.body).to.containDeep(wallet);
    const result = await walletRepository.findById(response.body.id);
    expect(result).to.containDeep(wallet);
  });

  context('when dealing with multiple persisted wallets', () => {
    let persistedWallets: Wallet[];

    beforeEach(async () => {
      const otherWallet = await givenWalletInstance(walletRepository, {
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
        userId: user.id,
      });
      persistedWallets = [defaultWallet, otherWallet];
    });

    it('finds all wallets', async () => {
      const response = await client
        .get(`/users/${user.id}/wallets`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);
      expect(response.body.data).to.containDeep(toJSON(persistedWallets));
    });

    it('queries wallets with a filter', async () => {
      const walletInProgress = await givenWalletInstance(walletRepository, {
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61763',
        userId: user.id,
      });

      const query = {
        filter: {
          where: {
            id: walletInProgress.id,
          },
        },
      };

      await client
        .get(`/users/${user.id}/wallets`)
        .set('Authorization', `Bearer ${token}`)
        .query(query)
        .expect(200, {
          data: [toJSON(walletInProgress)],
          meta: {
            currentPage: 1,
            itemsPerPage: 1,
            totalItemCount: 1,
            totalPageCount: 1,
          },
        });
    });

    it('exploded filter conditions work', async () => {
      await givenWalletInstance(walletRepository, {
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee62163',
        userId: user.id,
      });

      const response = await client
        .get(`/users/${user.id}/wallets`)
        .set('Authorization', `Bearer ${token}`)
        .query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });
});

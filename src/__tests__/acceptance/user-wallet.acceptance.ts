import {Client, expect, toJSON} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {User, Wallet} from '../../models';
import {UserRepository, WalletRepository} from '../../repositories';
import {
  givenAccesToken,
  givenOtherUser,
  givenUserInstance,
  givenUserRepository,
  givenWallet,
  givenWalletInstance,
  givenWalletRepository,
  setupApplication,
} from '../helpers';
import _ from 'lodash';
import {EntityNotFoundError} from '@loopback/repository';

describe('UserWalletApplication', () => {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let userRepository: UserRepository;
  let walletRepository: WalletRepository;
  let user: User;
  let otherUser: User;
  let defaultWallet: Wallet;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    userRepository = await givenUserRepository(app);
    walletRepository = await givenWalletRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    otherUser = await givenUserInstance(userRepository, givenOtherUser());
    token = await givenAccesToken(user);
  });

  beforeEach(async () => {
    await walletRepository.deleteAll();
    defaultWallet = await userRepository
      .wallets(user.id)
      .create(givenWallet({primary: true, hide: false}));
  });

  after(async () => {
    await userRepository.deleteAll();
  });

  it('returns 401 when accessing user wallet endpoint without access token', async () => {
    await client.get('/users/9999/wallets').expect(401);
  });

  it('creates a wallet for user', async () => {
    const wallet = givenWallet({
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
    });
    const response = await client
      .post(`/users/${user.id}/wallets`)
      .set('Authorization', `Bearer ${token}`)
      .send(wallet)
      .expect(200);

    wallet.primary = false;
    wallet.hide = false;
    expect(response.body).to.containDeep(wallet);
    const result = await walletRepository.findById(response.body.id);
    expect(result).to.containDeep(wallet);
  });

  it('returns 409 when creating duplicate wallet id', async () => {
    await givenWalletInstance(
      walletRepository,
      givenWallet({
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
      }),
    );
    const wallet = givenWallet({
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
    });
    await client
      .post(`/users/${user.id}/wallets`)
      .set('Authorization', `Bearer ${token}`)
      .send(wallet)
      .expect(409);
  });

  context('when dealing with multiple persisted wallets', () => {
    let persistedWallets: Wallet[];

    beforeEach(async () => {
      const otherWallet = await givenWalletInstance(walletRepository, {
        id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
        primary: false,
        hide: false,
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
        primary: false,
        hide: false,
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
        primary: false,
        hide: false,
        userId: user.id,
      });

      const response = await client
        .get(`/users/${user.id}/wallets`)
        .set('Authorization', `Bearer ${token}`)
        .query('pageLimit=2');
      expect(response.body.data).to.have.length(2);
    });
  });

  context('when dealing with a single persisted wallet', () => {
    let persistedWallet: Wallet;

    beforeEach(async () => {
      persistedWallet = await givenWalletInstance(walletRepository, {
        id: '0x06cc7ed22ebd1lfcc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee62163',
        primary: false,
        hide: false,
        userId: user.id,
      });
    });

    it('updates the wallet name', async () => {
      const updatedWallet = _.pick(givenWallet({name: 'john doe'}), ['name']);
      const response = await client
        .patch(`/users/${user.id}/wallets/${persistedWallet.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedWallet)
        .expect(200);

      expect(response.body.count).to.be.equal(1);

      const result = await walletRepository.findById(persistedWallet.id);
      persistedWallet.name = 'john doe';

      expect(_.omit(result, ['createdAt', 'updatedAt'])).to.containDeep(
        _.omit(persistedWallet, ['createdAt', 'updatedAt']),
      );
    });

    it('set wallet as primary', async () => {
      const updatedWallet = _.pick(givenWallet({primary: true}), ['primary']);
      const response = await client
        .patch(`/users/${user.id}/wallets/${persistedWallet.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedWallet)
        .expect(200);

      expect(response.body.count).to.be.equal(1);
      const result = await walletRepository.findById(persistedWallet.id);
      persistedWallet.primary = true;

      expect(_.omit(result, ['createdAt', 'updatedAt'])).to.containDeep(
        _.omit(persistedWallet, ['createdAt', 'updatedAt']),
      );

      const walletId = defaultWallet.id;
      const otherWallet = await walletRepository.findById(walletId);
      expect(_.omit(otherWallet, ['createdAt', 'updatedAt'])).to.containDeep(
        _.omit(_.assign(otherWallet, {primary: false}), [
          'createdAt',
          'updatedAt',
        ]),
      );
    });

    it('returns 401 when updating a wallet not as login user', async function () {
      const updatedWallet = _.pick(givenWallet({name: 'john doe'}), ['name']);
      const accessToken = await givenAccesToken(otherUser);

      await client
        .patch(`/users/${user.id}/wallets/${persistedWallet.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updatedWallet)
        .expect(401);
    });

    it('returns 422 when setting wallet primary as false', async () => {
      const updatedWallet = _.pick(givenWallet({primary: false}), ['primary']);
      await client
        .patch(`/users/${user.id}/wallets/${persistedWallet.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedWallet)
        .expect(422);
    });

    it('returns 401 when deleting user wallet not as login user', async () => {
      const accessToken = await givenAccesToken(otherUser);

      await client
        .del(`/users/${user.id}/wallets/${persistedWallet.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(401);
    });

    it('returns 422 when deleting the primary wallet', async () => {
      await client
        .del(`/users/${user.id}/wallets/${defaultWallet.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(422);
    });

    it('deletes wallet', async () => {
      const response = await client
        .del(`/users/${user.id}/wallets/${persistedWallet.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(200);

      expect(response.body.count).to.be.equal(1);

      await expect(
        walletRepository.findById(persistedWallet.id),
      ).to.be.rejectedWith(EntityNotFoundError);
    });

    it('returns 422 when deleting the only wallet', async () => {
      await client
        .del(`/users/${user.id}/wallets/${defaultWallet.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send()
        .expect(422);
    });

    // it('returns 404 when getting a currency that does not exist', () => {
    //   return client
    //     .get('/currencies/99999')
    //     .set('Authorization', `Bearer ${token}`)
    //     .expect(404);
    // });

    // it('deletes the currency', async () => {
    //   await client
    //     .del(`/currencies/${persistedWallet.id}`)
    //     .set('Authorization', `Bearer ${token}`)
    //     .send()
    //     .expect(204);
    //   await expect(
    //     currencyRepository.findById(persistedWallet.id),
    //   ).to.be.rejectedWith(EntityNotFoundError);
    // });

    // it('returns 404 when deleting a currency that does not exist', async () => {
    //   await client
    //     .del(`/currencies/99999`)
    //     .set('Authorization', `Bearer ${token}`)
    //     .expect(404);
    // });
  });
});

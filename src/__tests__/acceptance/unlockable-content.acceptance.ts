import {Client, expect} from '@loopback/testlab';
import {omit} from 'lodash';
import {MyriadApiApplication} from '../../application';
import {ReferenceType} from '../../enums';
import {Token} from '../../interfaces';
import {Currency, UnlockableContentWithRelations, User} from '../../models';
import {
  ContentPriceRepository,
  CurrencyRepository,
  ServerRepository,
  TransactionRepository,
  UnlockableContentRepository,
  UserRepository,
} from '../../repositories';
import {
  deleteAllRepository,
  givenAccesToken,
  givenContentPriceRepository,
  givenCurrencyInstance,
  givenCurrencyRepository,
  givenOtherUser,
  givenServerInstance,
  givenServerRepository,
  givenTransaction,
  givenTransactionInstance,
  givenTransactionRepository,
  givenUnlockableContent,
  givenUnlockableContentInstance,
  givenUnlockableContentRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';

describe('UnlockableContentApplication', () => {
  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let userRepository: UserRepository;
  let serverRepository: ServerRepository;
  let transactionRepository: TransactionRepository;
  let currencyRepository: CurrencyRepository;
  let unlockableContentRepository: UnlockableContentRepository;
  let contentPriceRepository: ContentPriceRepository;
  let user: User;
  let currency: Currency;

  before(async () => {
    ({app, client} = await setupApplication());
  });

  after(() => app.stop());

  before(async () => {
    userRepository = await givenUserRepository(app);
    currencyRepository = await givenCurrencyRepository(app);
    transactionRepository = await givenTransactionRepository(app);
    unlockableContentRepository = await givenUnlockableContentRepository(app);
    serverRepository = await givenServerRepository(app);
    contentPriceRepository = await givenContentPriceRepository(app);
  });

  beforeEach(async () => {
    currency = await givenCurrencyInstance(currencyRepository);
    user = await givenUserInstance(userRepository);
    token = await givenAccesToken(user);

    await givenServerInstance(serverRepository);
  });

  before(async () => {
    await unlockableContentRepository.deleteAll();
  });

  afterEach(async () => {
    await serverRepository.deleteAll();
  });

  after(async () => {
    await deleteAllRepository(app);
  });

  it('create an unlockable content', async () => {
    const content = givenUnlockableContent({
      createdBy: user.id,
      contentPrices: [{currencyId: currency.id, amount: 100}],
    });
    const response = await client
      .post('/user/unlockable-contents')
      .set('Authorization', `Bearer ${token}`)
      .send(content)
      .expect(200);
    expect(response.body).to.containDeep(omit(content, ['contentPrices']));
    const result = await unlockableContentRepository.findById(response.body.id);
    expect(result).to.containDeep(omit(content, ['contentPrices']));
    const contentPrice = await contentPriceRepository.findOne({
      where: {unlockableContentId: result.id},
    });
    expect(contentPrice).to.containEql({
      currencyId: currency.id,
      amount: 100,
      unlockableContentId: result.id,
    });
  });

  context('when dealing with a single persisted unlockable content', () => {
    let persistedUnlockableContent: UnlockableContentWithRelations;
    let otherToken: Token;
    let otherUser: User;

    beforeEach(async () => {
      otherUser = await givenUserInstance(userRepository, givenOtherUser());
      otherToken = await givenAccesToken(otherUser);
      persistedUnlockableContent = await givenUnlockableContentInstance(
        unlockableContentRepository,
        {
          createdBy: user.id,
        },
      );
    });

    it('hides content when current user not paid', async () => {
      const result = await client
        .get(`/user/unlockable-contents/${persistedUnlockableContent.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send()
        .expect(200);
      expect(result.body.content).to.be.Undefined();
    });

    it('shows content when current user is paid', async () => {
      const transaction = givenTransaction({
        from: otherUser.id,
        to: user.id,
        currencyId: currency.id,
        referenceId: persistedUnlockableContent.id,
        type: ReferenceType.UNLOCKABLECONTENT,
      });
      await givenTransactionInstance(transactionRepository, transaction);

      const result = await client
        .get(`/user/unlockable-contents/${persistedUnlockableContent.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send()
        .expect(200);
      expect(result.body.content).to.be.not.Undefined();
    });
  });
});

import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {ReferenceType} from '../../enums';
import {Credential, Transaction, User} from '../../models';
import {TransactionRepository, UserRepository} from '../../repositories';
import {
  givenAddress,
  givenTransactionInstance,
  givenTransactionRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';
import {u8aToHex, numberToHex} from '@polkadot/util';
import {KeyringPair} from '@polkadot/keyring/types';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('TransactionSummaryApplication', function () {
  this.timeout(20000);

  let app: MyriadApiApplication;
  let token: string;
  let client: Client;
  let transactionRepository: TransactionRepository;
  let userRepository: UserRepository;
  let transactionSentInstance1: Transaction;
  let transactionReceivedInstance1: Transaction;
  let transactionSentInstance2: Transaction;
  let transactionReceivedInstance2: Transaction;
  let transactionSentInstance3: Transaction;
  let transactionReceivedInstance3: Transaction;
  let nonce: number;
  let user: User;
  let address: KeyringPair;

  before(async () => {
    ({app, client} = await setupApplication(true));
  });

  after(() => app.stop());

  before(async () => {
    transactionRepository = await givenTransactionRepository(app);
    userRepository = await givenUserRepository(app);
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    transactionSentInstance1 = await givenTransactionInstance(
      transactionRepository,
      {
        to: user.id,
        referenceId: '1',
        type: ReferenceType.POST,
      },
    );
    transactionReceivedInstance1 = await givenTransactionInstance(
      transactionRepository,
      {
        from: user.id,
      },
    );
    transactionSentInstance2 = await givenTransactionInstance(
      transactionRepository,
      {
        to: user.id,
        referenceId: '1',
        type: ReferenceType.POST,
      },
    );
    transactionReceivedInstance2 = await givenTransactionInstance(
      transactionRepository,
      {
        from: user.id,
      },
    );
    transactionSentInstance3 = await givenTransactionInstance(
      transactionRepository,
      {
        to: user.id,
        referenceId: '2',
        type: ReferenceType.COMMENT,
      },
    );
    transactionReceivedInstance3 = await givenTransactionInstance(
      transactionRepository,
      {
        from: user.id,
      },
    );

    address = givenAddress();
  });

  after(async () => {
    await userRepository.deleteAll();
    await transactionRepository.deleteAll();
  });

  it('gets user nonce', async () => {
    const response = await client.get(`/users/${user.id}/nonce`).expect(200);

    nonce = response.body.nonce;
  });

  it('user login successfully', async () => {
    const credential: Credential = new Credential({
      nonce: nonce,
      publicAddress: user.id,
      signature: u8aToHex(address.sign(numberToHex(nonce))),
    });

    const res = await client.post('/login').send(credential).expect(200);
    token = res.body.accessToken;
  });

  it('gets a user transaction summary', async function () {
    const response = await client
      .get(`/users/${user.id}/transaction-summary`)
      .set('Authorization', `Bearer ${token}`)
      .send()
      .expect(200);

    expect(response.body).to.deepEqual({
      sent: [
        {
          currencyId: 'ROC',
          amount:
            transactionSentInstance1.amount +
            transactionSentInstance2.amount +
            transactionSentInstance3.amount,
        },
      ],
      received: [
        {
          currencyId: 'ROC',
          amount:
            transactionReceivedInstance1.amount +
            transactionReceivedInstance2.amount +
            transactionReceivedInstance3.amount,
        },
      ],
    });
  });

  it('gets a post transaction summary', async function () {
    const response = await client
      .get(`/posts/1/transaction-summary`)
      .set('Authorization', `Bearer ${token}`)
      .send()
      .expect(200);

    expect(response.body).to.containDeep([
      {
        currencyId: 'ROC',
        amount:
          transactionSentInstance1.amount + transactionSentInstance2.amount,
      },
    ]);
  });

  it('gets a comment transaction summary', async function () {
    const response = await client
      .get(`/comments/2/transaction-summary`)
      .set('Authorization', `Bearer ${token}`)
      .send()
      .expect(200);

    expect(response.body).to.containDeep([
      {
        currencyId: 'ROC',
        amount: transactionSentInstance3.amount,
      },
    ]);
  });
});

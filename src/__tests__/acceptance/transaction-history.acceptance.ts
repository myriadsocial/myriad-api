import {Client, expect} from '@loopback/testlab';
import {MyriadApiApplication} from '../../application';
import {DefaultCurrencyType} from '../../enums';
import {Transaction, User} from '../../models';
import {TransactionRepository, UserRepository} from '../../repositories';
import {
  givenTransactionInstance,
  givenTransactionRepository,
  givenUserInstance,
  givenUserRepository,
  setupApplication,
} from '../helpers';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('TransactionHistoryApplication', function () {
  this.timeout(10000);
  let app: MyriadApiApplication;
  let client: Client;
  let transactionRepository: TransactionRepository;
  let userRepository: UserRepository;
  let transactionSentInstance1: Transaction;
  let transactionReceivedInstance1: Transaction;
  let transactionSentInstance2: Transaction;
  let transactionReceivedInstance2: Transaction;
  let user: User;

  before(async () => {
    ({app, client} = await setupApplication(true));
  });

  after(() => app.stop());

  before(async () => {
    transactionRepository = await givenTransactionRepository(app);
    userRepository = await givenUserRepository(app);
  });

  before(async () => {
    await transactionRepository.deleteAll();
    await userRepository.deleteAll();
  });

  before(async () => {
    user = await givenUserInstance(userRepository);
    transactionSentInstance1 = await givenTransactionInstance(transactionRepository, {
      to: user.id,
      postId: '1',
    });
    transactionReceivedInstance1 = await givenTransactionInstance(transactionRepository, {
      from: user.id,
    });
    transactionSentInstance2 = await givenTransactionInstance(transactionRepository, {
      to: user.id,
      postId: '1',
    });
    transactionReceivedInstance2 = await givenTransactionInstance(transactionRepository, {
      from: user.id,
    });
  });

  it('gets a user transaction history', async function () {
    const response = await client.get(`/users/${user.id}/transaction-histories`).send().expect(200);

    expect(response.body).to.deepEqual({
      sent: [
        {
          currencyId: DefaultCurrencyType.AUSD,
          amount: transactionSentInstance1.amount + transactionSentInstance2.amount,
        },
      ],
      received: [
        {
          currencyId: DefaultCurrencyType.AUSD,
          amount: transactionReceivedInstance1.amount + transactionReceivedInstance2.amount,
        },
      ],
    });
  });

  it('gets a post transaction history', async function () {
    const response = await client.get(`/posts/1/transaction-histories`).send().expect(200);

    expect(response.body).to.containDeep([
      {
        currencyId: DefaultCurrencyType.AUSD,
        amount: transactionSentInstance1.amount + transactionSentInstance2.amount,
      },
    ]);
  });
});

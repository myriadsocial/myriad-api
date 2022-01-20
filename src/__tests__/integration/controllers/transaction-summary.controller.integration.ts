import {expect} from '@loopback/testlab';
import {TransactionSummaryController} from '../../../controllers';
import {ReferenceType} from '../../../enums';
import {
  CommentRepository,
  CurrencyRepository,
  PostRepository,
  TransactionRepository,
  UserRepository,
} from '../../../repositories';
import {TransactionService} from '../../../services';
import {
  givenCommentInstance,
  givenCurrencyInstance,
  givenEmptyDatabase,
  givenPostInstance,
  givenRepositories,
  givenTransactionInstance,
  givenUserInstance,
  testDBMongo,
} from '../../helpers';

/* eslint-disable  @typescript-eslint/no-invalid-this */
describe('TransactionSummaryControllerIntegration', function () {
  this.timeout(20000);
  let userRepository: UserRepository;
  let transactionRepository: TransactionRepository;
  let currencyRepository: CurrencyRepository;
  let postRepository: PostRepository;
  let commentRepository: CommentRepository;
  let transactionService: TransactionService;
  let controller: TransactionSummaryController;

  before(async () => {
    ({
      userRepository,
      transactionRepository,
      currencyRepository,
      postRepository,
      commentRepository,
      transactionService,
    } = await givenRepositories(testDBMongo));
  });

  before(async () => {
    controller = new TransactionSummaryController(transactionService);
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testDBMongo);
  });

  it('gets transaction summary of users', async () => {
    const user = await givenUserInstance(userRepository);
    const otherUser = await givenUserInstance(userRepository, {
      username: 'johndoe',
    });
    const currency = await givenCurrencyInstance(currencyRepository);
    const transactionSent = await givenTransactionInstance(
      transactionRepository,
      {
        from: user.id,
        to: otherUser.id,
        currencyId: currency.id,
      },
    );
    const transactionReceived = await givenTransactionInstance(
      transactionRepository,
      {
        from: otherUser.id,
        to: user.id,
        currencyId: currency.id,
      },
    );

    const response = await controller.userTransactionSummary(
      user.id.toString(),
    );

    expect(response).to.containDeep({
      sent: [
        {
          currencyId: currency.id,
          amount: transactionSent.amount,
        },
      ],
      received: [
        {
          currencyId: currency.id,
          amount: transactionReceived.amount,
        },
      ],
    });
  });

  it('gets transaction summary of posts', async () => {
    const user = await givenUserInstance(userRepository);
    const post = await givenPostInstance(postRepository);
    const currency = await givenCurrencyInstance(currencyRepository);
    const transaction = await givenTransactionInstance(transactionRepository, {
      from: user.id,
      currencyId: currency.id,
      referenceId: post.id.toString(),
      type: ReferenceType.POST,
    });

    const response = await controller.postTransactionSummary(
      post.id.toString(),
    );

    expect(response).to.containDeep([
      {
        currencyId: currency.id,
        amount: transaction.amount,
      },
    ]);
  });

  it('gets transaction summary of comments', async () => {
    const user = await givenUserInstance(userRepository);
    const otherUser = await givenUserInstance(userRepository, {
      username: 'johndoe',
    });
    const post = await givenPostInstance(postRepository);
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: post.id,
    });
    const currency = await givenCurrencyInstance(currencyRepository);

    const transaction = await givenTransactionInstance(transactionRepository, {
      from: user.id,
      to: otherUser.id,
      currencyId: currency.id,
      referenceId: comment.id ? comment.id.toString() : '',
      type: ReferenceType.COMMENT,
    });

    const response = await controller.commentTransactionSummary(
      comment.id ? comment.id.toString() : '',
    );

    expect(response).to.containDeep([
      {
        currencyId: currency.id,
        amount: transaction.amount,
      },
    ]);
  });
});

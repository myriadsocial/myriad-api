import {
  createStubInstance,
  expect,
  sinon,
  StubbedInstanceWithSinonAccessor,
  toJSON,
} from '@loopback/testlab';
import {TransactionController} from '../../controllers';
import {Transaction} from '../../models';
import {TransactionRepository} from '../../repositories';
import {NotificationService} from '../../services';
import {givenTransaction} from '../helpers';

describe('TransactionController', () => {
  let transactionRepository: StubbedInstanceWithSinonAccessor<TransactionRepository>;
  let notificationService: NotificationService;
  let controller: TransactionController;
  let aTransaction: Transaction;
  let aTransactionWithId: Transaction;
  let aListOfTransactions: Transaction[];

  beforeEach(resetRepositories);

  describe('createTransaction', () => {
    it('creates a Transaction', async () => {
      const create = transactionRepository.stubs.create;
      create.resolves(aTransactionWithId);
      const result = await controller.create(aTransaction);
      expect(result).to.eql(aTransactionWithId);
      sinon.assert.calledWith(create, aTransaction);
    });
  });

  describe('findTransactionById', () => {
    it('returns a transaction if it exists', async () => {
      const findById = transactionRepository.stubs.findById;
      findById.resolves(aTransactionWithId);
      expect(await controller.findById(aTransactionWithId.id as string)).to.eql(
        aTransactionWithId,
      );
      sinon.assert.calledWith(findById, aTransactionWithId.id);
    });
  });

  describe('findTransactions', () => {
    it('returns multiple transactions if they exist', async () => {
      const find = transactionRepository.stubs.find;
      find.resolves(aListOfTransactions);
      expect(await controller.find()).to.eql(aListOfTransactions);
      sinon.assert.called(find);
    });

    it('returns empty list if no transactions exist', async () => {
      const find = transactionRepository.stubs.find;
      const expected: Transaction[] = [];
      find.resolves(expected);
      expect(await controller.find()).to.eql(expected);
      sinon.assert.called(find);
    });

    it('uses the provided filter', async () => {
      const find = transactionRepository.stubs.find;
      const filter = toJSON({
        where: {
          from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61864',
        },
      });

      find.resolves(aListOfTransactions);
      await controller.find(filter);
      sinon.assert.calledWith(find, filter);
    });
  });

  function resetRepositories() {
    transactionRepository = createStubInstance(TransactionRepository);
    aTransaction = givenTransaction();
    aTransactionWithId = givenTransaction({
      id: '1',
    });
    aListOfTransactions = [
      aTransactionWithId,
      givenTransaction({
        id: '2',
        hash: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61867',
        amount: 1,
        from: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61868',
        to: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61869',
        currencyId: 'AUSD',
      }),
    ] as Transaction[];

    controller = new TransactionController(
      transactionRepository,
      notificationService,
    );
  }
});

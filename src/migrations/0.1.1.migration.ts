import {repository} from '@loopback/repository';
import {MigrationScript, migrationScript} from 'loopback4-migration';
import {DefaultCurrencyType, TransactionType} from '../enums';
import {Transaction} from '../models';
import {CurrencyRepository, TransactionRepository} from '../repositories';

/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  @typescript-eslint/naming-convention */
@migrationScript()
export class MigrationScript010 implements MigrationScript {
  version = '0.1.1';

  constructor(
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
  ) {}

  async up(): Promise<void> {
    await this.doMigrateTransactions();
    await this.doMigrateCurrencies();
  }

  async doMigrateTransactions(): Promise<void> {
    const collection = (this.transactionRepository.dataSource.connector as any).collection(
      Transaction.modelName,
    );

    await collection.updateMany(<any>{
      $rename: {
        postId: 'referenceId',
      },
    });

    const transactions = await this.transactionRepository.find();

    await Promise.all(
      transactions.map(transaction => {
        if (transaction.referenceId) {
          this.transactionRepository.updateById(transaction.id, {type: TransactionType.POST});
        }

        return null;
      }),
    );
  }

  async doMigrateCurrencies(): Promise<void> {
    await this.currencyRepository.updateById(DefaultCurrencyType.MYRIA, {
      decimal: 18,
      addressType: 42,
    });
  }
}

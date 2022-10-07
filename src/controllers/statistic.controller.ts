import {AnyObject, repository} from '@loopback/repository';
import {get, param, response} from '@loopback/rest';
import {Transaction, User} from '../models';
import {
  CurrencyRepository,
  TransactionRepository,
  UserRepository,
} from '../repositories';

export class StatisticController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
    @repository(CurrencyRepository)
    protected currencyRepository: CurrencyRepository,
  ) {}

  @get('/user-growth')
  @response(200, {
    description: 'User Growth',
  })
  async getUserGrowth(@param.query.string('limit') limit = 7) {
    const userCollection = (
      this.userRepository.dataSource.connector as AnyObject
    ).collection(User.modelName);

    const date = new Date();

    date.setHours(0, 0, 0, 0);

    const miliseconds = date.getTime() - limit * 24 * 60 * 60 * 1000;
    const result = await userCollection
      .aggregate([
        {
          $match: {
            createdAt: {
              $gt: new Date(miliseconds),
            },
          },
        },
        {
          $group: {
            _id: {
              year: {$year: '$createdAt'},
              month: {$month: '$createdAt'},
              day: {$dayOfMonth: '$createdAt'},
            },
            count: {$sum: 1},
          },
        },
        {
          $sort: {
            '_id.year': -1,
            '_id.month': -1,
            '_id.day': -1,
          },
        },
      ])
      .get();

    const formatGroup = result.map((e: AnyObject) => {
      return {
        [`${e._id.month}-${e._id.day}-${e._id.year}`]: e.count,
      };
    });

    const completeFormatGroup: AnyObject[] = [];

    for (let i = 0; i < limit; i++) {
      const milisecond = date.getTime() - i * 24 * 60 * 60 * 1000;
      const current = new Date(milisecond)
        .toLocaleString()
        .replace(/\//gi, '-')
        .split(',')[0];

      const data = {
        date: current,
        count: 0,
      };

      const found = formatGroup.find((e: AnyObject) => Boolean(e[current]));
      if (found) data.count = found[current];

      completeFormatGroup.push(data);
    }

    return completeFormatGroup;
  }

  @get('/top-currencies')
  @response(200, {
    description: 'Top Currencies',
  })
  async getTopCurrency(@param.query.number('limit') limit = 5) {
    const transactionCollection = (
      this.transactionRepository.dataSource.connector as AnyObject
    ).collection(Transaction.modelName);

    const result = await transactionCollection
      .aggregate([
        {
          $group: {
            _id: {currencyId: '$currencyId'},
            totalTransactions: {$sum: 1},
          },
        },
        {$sort: {totalTransactions: -1}},
        {$limit: limit},
      ])
      .get();

    const data: AnyObject[] = [];
    const currencyIds = result.map((e: AnyObject) => e._id.currencyId);
    const currencies = await this.currencyRepository.find({
      where: {id: {inq: currencyIds}},
    });

    for (const coin of result) {
      const currency = currencies.find(({id}) => id === coin._id.currencyId);
      data.push({
        ...currency,
        totalTransactions: coin.totalTransactions,
      });
    }

    return data;
  }
}

import {BindingScope, injectable, service} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {Transaction, User} from '../models';
import {
  CurrencyRepository,
  TransactionRepository,
  UserRepository,
} from '../repositories';
import {ServerService} from './server.service';

export interface UserGrowthData {
  date: string;
  count: number;
}

export interface CurrencyWithTransaction {
  id: string;
  name: string;
  symbol: string;
  image: string;
  networkId: string;
  totalTransactions: number;
}

export interface StatisticData {
  post: number;
  comment: number;
  experience: number;
  transaction: number;
  subscription: number;
}

@injectable({scope: BindingScope.TRANSIENT})
export class StatisticService {
  constructor(
    @repository(CurrencyRepository)
    private currencyRepository: CurrencyRepository,
    @repository(TransactionRepository)
    private transactionRepository: TransactionRepository,
    @repository(UserRepository)
    private userRepository: UserRepository,
    @service(ServerService)
    private serverService: ServerService,
  ) {}

  public async median(): Promise<StatisticData> {
    const server = await this.serverService.find();
    const [
      userPost,
      userComment,
      userExperience,
      userTransaction,
      userSubscription,
    ] = await Promise.all([
      this.userRepository.find({
        order: ['metric.totalPosts ASC'],
        skip: Math.ceil(server.metric.totalPosts.totalAll / 2),
        limit: 1,
      }),
      this.userRepository.find({
        order: ['metric.totalComments ASC'],
        skip: Math.ceil(server.metric.totalComments / 2),
        limit: 1,
      }),
      this.userRepository.find({
        order: ['metric.totalExperiences ASC'],
        skip: Math.ceil(server.metric.totalExperiences / 2),
        limit: 1,
      }),
      this.userRepository.find({
        order: ['metric.totalTransactions ASC'],
        skip: Math.ceil(server.metric.totalTransactions / 2),
        limit: 1,
      }),
      this.userRepository.find({
        order: ['metric.totalSubscriptions ASC'],
        skip: Math.ceil(server.metric.totalSubscriptions / 2),
        limit: 1,
      }),
    ]);

    return {
      post: userPost?.[0]?.metric?.totalPosts ?? 0,
      comment: userComment?.[0]?.metric?.totalComments ?? 0,
      experience: userExperience?.[0]?.metric?.totalExperiences ?? 0,
      transaction: userTransaction?.[0]?.metric?.totalTransactions ?? 0,
      subscription: userSubscription?.[0]?.metric?.totalSubscriptions ?? 0,
    };
  }

  public async average(): Promise<StatisticData> {
    const {
      metric: {
        totalUsers,
        totalComments,
        totalPosts: {totalAll},
        totalExperiences,
        totalTransactions,
        totalSubscriptions,
      },
    } = await this.serverService.find();

    const averagePost = totalAll / totalUsers;
    const averageComment = totalComments / totalUsers;
    const averageExpereince = totalExperiences / totalUsers;
    const averageTransaction = totalTransactions / totalUsers;
    const averageSubscription = totalSubscriptions / totalUsers;

    return {
      post: averagePost,
      comment: averageComment,
      experience: averageExpereince,
      transaction: averageTransaction,
      subscription: averageSubscription,
    };
  }

  public async userGrowth(limit: number): Promise<UserGrowthData[]> {
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

    const completeFormatGroup: UserGrowthData[] = [];

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

  public async topCurrencies(
    limit: number,
  ): Promise<CurrencyWithTransaction[]> {
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

    const data: CurrencyWithTransaction[] = [];
    const currencyIds = result.map((e: AnyObject) => e._id.currencyId);
    const currencies = await this.currencyRepository.find({
      where: {id: {inq: currencyIds}},
    });

    for (const coin of result) {
      const currency = currencies.find(({id}) => id === coin._id.currencyId);
      if (!currency) continue;
      data.push({
        id: currency.id,
        name: currency.name,
        symbol: currency.symbol,
        image: currency.image,
        networkId: currency.networkId,
        totalTransactions: coin.totalTransactions as number,
      });
    }

    return data;
  }
}

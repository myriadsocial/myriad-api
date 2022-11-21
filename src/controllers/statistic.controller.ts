import {service} from '@loopback/core';
import {get, param, response} from '@loopback/rest';
import {
  CurrencyWithTransaction,
  StatisticData,
  StatisticService,
  UserGrowthData,
} from '../services';

export class StatisticController {
  constructor(
    @service(StatisticService)
    private statisticService: StatisticService,
  ) {}

  @get('/stats/user-growth')
  @response(200, {
    description: 'User Growth',
  })
  async getUserGrowth(
    @param.query.string('limit') limit = 7,
  ): Promise<UserGrowthData[]> {
    return this.statisticService.userGrowth(limit);
  }

  @get('/stats/top-currencies')
  @response(200, {
    description: 'Top Currencies',
  })
  async getTopCurrency(
    @param.query.number('limit') limit = 5,
  ): Promise<CurrencyWithTransaction[]> {
    return this.statisticService.topCurrencies(limit);
  }

  @get('/stats/average')
  @response(200, {
    description: 'Averages',
  })
  async getAverage(): Promise<StatisticData> {
    return this.statisticService.average();
  }

  @get('/stats/median')
  @response(200, {
    description: 'Medain',
  })
  async getMedian(): Promise<StatisticData> {
    return this.statisticService.median();
  }
}

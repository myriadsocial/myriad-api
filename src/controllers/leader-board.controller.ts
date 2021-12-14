import {intercept} from '@loopback/core';
import {Filter, repository} from '@loopback/repository';
import {param, get, getModelSchemaRef, response} from '@loopback/rest';
import {PaginationInterceptor} from '../interceptors';
import {LeaderBoard} from '../models';
import {LeaderBoardRepository} from '../repositories';

export class LeaderBoardController {
  constructor(
    @repository(LeaderBoardRepository)
    public leaderBoardRepository: LeaderBoardRepository,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/leader-boards')
  @response(200, {
    description: 'Array of LeaderBoard model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(LeaderBoard, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(LeaderBoard, {
      exclude: ['limit', 'skip', 'offset', 'include'],
    })
    filter?: Filter<LeaderBoard>,
  ): Promise<LeaderBoard[]> {
    return this.leaderBoardRepository.find(filter);
  }
}

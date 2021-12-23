import {inject, intercept} from '@loopback/core';
import {Filter, repository} from '@loopback/repository';
import {param, get, getModelSchemaRef, response} from '@loopback/rest';
import {PaginationInterceptor} from '../interceptors';
import {LeaderBoard} from '../models';
import {LeaderBoardRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';
import {LoggingBindings, logInvocation, WinstonLogger} from '@loopback/logging';

@authenticate('jwt')
export class LeaderBoardController {
  // Inject a winston logger
  @inject(LoggingBindings.WINSTON_LOGGER)
  private logger: WinstonLogger;

  constructor(
    @repository(LeaderBoardRepository)
    public leaderBoardRepository: LeaderBoardRepository,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @logInvocation()
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

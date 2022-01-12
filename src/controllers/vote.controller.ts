import {inject, intercept, service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {del, getModelSchemaRef, param, post, requestBody} from '@loopback/rest';
import {ValidateVoteInterceptor} from '../interceptors';
import {Vote} from '../models';
import {VoteRepository} from '../repositories';
import {NotificationService} from '../services';
import {authenticate} from '@loopback/authentication';
import {LoggingBindings, logInvocation, WinstonLogger} from '@loopback/logging';

@authenticate('jwt')
@intercept(ValidateVoteInterceptor.BINDING_KEY)
export class VoteController {
  // Inject a winston logger
  @inject(LoggingBindings.WINSTON_LOGGER)
  private logger: WinstonLogger;

  constructor(
    @repository(VoteRepository)
    protected voteRepository: VoteRepository,
    @service(NotificationService)
    protected notificationService: NotificationService,
  ) {}

  @logInvocation()
  @post('/votes', {
    responses: {
      '200': {
        description: 'Vote model instance',
        content: {'application/json': {schema: getModelSchemaRef(Vote)}},
      },
    },
  })
  async createVote(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Vote, {
            title: 'NewVote',
            exclude: ['toUserId'],
          }),
        },
      },
    })
    vote: Omit<Vote, 'id'>,
  ): Promise<Vote> {
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    const collection = (
      this.voteRepository.dataSource.connector as any
    ).collection(Vote.modelName);
    const query = {
      userId: vote.userId,
      type: vote.type,
      referenceId: vote.referenceId,
    };
    const update = {
      $set: vote,
    };
    const options = {upsert: true, returnDocument: 'after'};

    const result = await collection.findOneAndUpdate(query, update, options);

    return result;
  }

  @logInvocation()
  @del('/votes/{id}', {
    responses: {
      '200': {
        description: 'Vote DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    return this.voteRepository.deleteById(id);
  }
}

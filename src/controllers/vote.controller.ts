import {intercept, service} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {del, getModelSchemaRef, param, post, requestBody} from '@loopback/rest';
import {CreateInterceptor, DeleteInterceptor} from '../interceptors';
import {Vote} from '../models';
import {VoteRepository} from '../repositories';
import {NotificationService} from '../services';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
export class VoteController {
  constructor(
    @repository(VoteRepository)
    protected voteRepository: VoteRepository,
    @service(NotificationService)
    protected notificationService: NotificationService,
  ) {}

  @intercept(CreateInterceptor.BINDING_KEY)
  @post('/votes', {
    responses: {
      '200': {
        description: 'Vote model instance',
        content: {'application/json': {schema: getModelSchemaRef(Vote)}},
      },
    },
  })
  async create(
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
    const collection = (
      this.voteRepository.dataSource.connector as AnyObject
    ).collection(Vote.modelName);
    const query = {
      userId: vote.userId,
      type: vote.type,
      referenceId: vote.referenceId,
    };
    const update = {$set: vote};
    const options = {upsert: true, returnDocument: 'after'};

    return collection.findOneAndUpdate(query, update, options);
  }

  @intercept(DeleteInterceptor.BINDING_KEY)
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

import {intercept} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {del, getModelSchemaRef, param, post, requestBody} from '@loopback/rest';
import {CreateInterceptor, DeleteInterceptor} from '../interceptors';
import {Vote} from '../models';
import {VoteRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
export class VoteController {
  constructor(
    @repository(VoteRepository)
    protected voteRepository: VoteRepository,
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
  async deleteById(
    @param.path.string('id') id: string,
    @param.query.string('vote') vote?: AnyObject,
  ): Promise<void> {
    if (vote) {
      return this.voteRepository.deleteById(id);
    }
  }
}

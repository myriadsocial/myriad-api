import {authenticate} from '@loopback/authentication';
import {intercept, service} from '@loopback/core';
import {Count} from '@loopback/repository';
import {del, getModelSchemaRef, param, post, requestBody} from '@loopback/rest';
import {CreateInterceptor} from '../../interceptors';
import {Vote} from '../../models';
import {UserService} from '../../services';

@authenticate('jwt')
export class VoteController {
  constructor(
    @service(UserService)
    private userService: UserService,
  ) {}

  @intercept(CreateInterceptor.BINDING_KEY)
  @post('/votes', {
    responses: {
      '200': {
        description: 'CREATE vote',
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
    return this.userService.createVote(vote);
  }

  @del('/votes/{id}', {
    responses: {
      '200': {
        description: 'REMOVE vote',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<Count> {
    return this.userService.removeVote(id);
  }
}

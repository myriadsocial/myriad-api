import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  Conversation,
  User,
} from '../models';
import {ConversationRepository} from '../repositories';

export class ConversationUserController {
  // constructor(
  //   @repository(ConversationRepository)
  //   public conversationRepository: ConversationRepository,
  // ) { }

  // @get('/conversations/{id}/user', {
  //   responses: {
  //     '200': {
  //       description: 'User belonging to Conversation',
  //       content: {
  //         'application/json': {
  //           schema: {type: 'array', items: getModelSchemaRef(User)},
  //         },
  //       },
  //     },
  //   },
  // })
  // async getUser(
  //   @param.path.string('id') id: typeof Conversation.prototype.id,
  // ): Promise<User> {
  //   return this.conversationRepository.user(id);
  // }
}

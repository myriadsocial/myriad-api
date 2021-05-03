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
  Post,
} from '../models';
import {ConversationRepository} from '../repositories';

export class ConversationPostController {
  // constructor(
  //   @repository(ConversationRepository)
  //   public conversationRepository: ConversationRepository,
  // ) { }

  // @get('/conversations/{id}/post', {
  //   responses: {
  //     '200': {
  //       description: 'Post belonging to Conversation',
  //       content: {
  //         'application/json': {
  //           schema: {type: 'array', items: getModelSchemaRef(Post)},
  //         },
  //       },
  //     },
  //   },
  // })
  // async getPost(
  //   @param.path.string('id') id: typeof Conversation.prototype.id,
  // ): Promise<Post> {
  //   return this.conversationRepository.post(id);
  // }
}

import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import {
  User,
  Conversation,
} from '../models';
import {UserRepository} from '../repositories';

export class UserConversationController {
  constructor(
    @repository(UserRepository) protected userRepository: UserRepository,
  ) { }

  // @get('/users/{id}/conversations', {
  //   responses: {
  //     '200': {
  //       description: 'Array of User has many Conversation',
  //       content: {
  //         'application/json': {
  //           schema: {type: 'array', items: getModelSchemaRef(Conversation)},
  //         },
  //       },
  //     },
  //   },
  // })
  // async find(
  //   @param.path.string('id') id: string,
  //   @param.query.object('filter') filter?: Filter<Conversation>,
  // ): Promise<Conversation[]> {
  //   return this.userRepository.conversations(id).find(filter);
  // }

  // @post('/users/{id}/conversations', {
  //   responses: {
  //     '200': {
  //       description: 'User model instance',
  //       content: {'application/json': {schema: getModelSchemaRef(Conversation)}},
  //     },
  //   },
  // })
  // async create(
  //   @param.path.string('id') id: typeof User.prototype.id,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(Conversation, {
  //           title: 'NewConversationInUser',
  //           exclude: ['id'],
  //           optional: ['userId']
  //         }),
  //       },
  //     },
  //   }) conversation: Omit<Conversation, 'id'>,
  // ): Promise<Conversation> {
  //   return this.userRepository.conversations(id).create({
  //     ...conversation,
  //     createdAt: new Date().toString(),
  //     updatedAt: new Date().toString()
  //   });
  // }

  // @patch('/users/{id}/conversations', {
  //   responses: {
  //     '200': {
  //       description: 'User.Conversation PATCH success count',
  //       content: {'application/json': {schema: CountSchema}},
  //     },
  //   },
  // })
  // async patch(
  //   @param.path.string('id') id: string,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(Conversation, {partial: true}),
  //       },
  //     },
  //   })
  //   conversation: Partial<Conversation>,
  //   @param.query.object('where', getWhereSchemaFor(Conversation)) where?: Where<Conversation>,
  // ): Promise<Count> {
  //   return this.userRepository.conversations(id).patch({
  //     ...conversation,
  //     updatedAt: new Date().toString()
  //   }, where);
  // }

  // @del('/users/{id}/conversations', {
  //   responses: {
  //     '200': {
  //       description: 'User.Conversation DELETE success count',
  //       content: {'application/json': {schema: CountSchema}},
  //     },
  //   },
  // })
  // async delete(
  //   @param.path.string('id') id: string,
  //   @param.query.object('where', getWhereSchemaFor(Conversation)) where?: Where<Conversation>,
  // ): Promise<Count> {
  //   return this.userRepository.conversations(id).delete(where);
  // }
}

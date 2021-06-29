import {
  Filter,
  FilterExcludingWhere,
  repository
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  put,
  requestBody,
  response
} from '@loopback/rest';
import {
  Conversation, Post, User
} from '../models';
import {ConversationRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class ConversationController {
  constructor(
    @repository(ConversationRepository)
    public conversationRepository: ConversationRepository,
  ) { }

  @post('/conversations')
  @response(200, {
    description: 'Conversation model instance',
    content: {'application/json': {schema: getModelSchemaRef(Conversation)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Conversation, {
            title: 'NewConversation',

          }),
        },
      },
    })
    conversation: Conversation,
  ): Promise<Conversation> {
    return this.conversationRepository.create({
      ...conversation,
      createdAt: new Date().toString(),
      updatedAt: new Date().toString()
    });
  }

  @get('/conversations')
  @response(200, {
    description: 'Array of Conversation model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Conversation, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Conversation) filter?: Filter<Conversation>,
  ): Promise<Conversation[]> {
    return this.conversationRepository.find(filter);
  }

  @get('/conversations/{id}')
  @response(200, {
    description: 'Conversation model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Conversation, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Conversation, {exclude: 'where'}) filter?: FilterExcludingWhere<Conversation>
  ): Promise<Conversation> {
    return this.conversationRepository.findById(id, filter);
  }

  @get('/conversations/{id}/user', {
    responses: {
      '200': {
        description: 'User belonging to Conversation',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(User)},
          },
        },
      },
    },
  })
  async getUser(
    @param.path.string('id') id: typeof Conversation.prototype.id,
  ): Promise<User> {
    return this.conversationRepository.user(id);
  }

  @get('/conversations/{id}/post', {
    responses: {
      '200': {
        description: 'Post belonging to Conversation',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Post)},
          },
        },
      },
    },
  })
  async getPost(
    @param.path.string('id') id: typeof Conversation.prototype.id,
  ): Promise<Post> {
    return this.conversationRepository.post(id);
  }

  @patch('/conversations/{id}')
  @response(204, {
    description: 'Conversation PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Conversation, {partial: true}),
        },
      },
    })
    conversation: Conversation,
  ): Promise<void> {
    await this.conversationRepository.updateById(id, {
      ...conversation,
      read: true,
      unreadMessage: 0,
      updatedAt: new Date().toString()
    });
  }

  @put('/conversations/{id}')
  @response(204, {
    description: 'Conversation PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() conversation: Conversation,
  ): Promise<void> {
    await this.conversationRepository.replaceById(id, conversation);
  }

  @del('/conversations/{id}')
  @response(204, {
    description: 'Conversation DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.conversationRepository.deleteById(id);
  }
}

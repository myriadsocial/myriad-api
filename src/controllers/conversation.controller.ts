import {intercept} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {defaultFilterQuery} from '../helpers/filter-utils';
import {PaginationInterceptor} from '../interceptors';
import {Conversation, Post, User} from '../models';
import {ConversationRepository} from '../repositories';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
@intercept(PaginationInterceptor.BINDING_KEY)
export class ConversationController {
  constructor(
    @repository(ConversationRepository)
    protected conversationRepository: ConversationRepository,
  ) {}

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
    conversation.createdAt = new Date().toString();
    conversation.updatedAt = new Date().toString();
    return this.conversationRepository.create(conversation);
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
    @param.query.number('page') page: number,
    @param.filter(Conversation, {exclude: ['skip', 'offset']}) filter?: Filter<Conversation>,
  ): Promise<Conversation[]> {
    filter = defaultFilterQuery(page, filter);
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
    @param.filter(Conversation, {exclude: 'where'})
    filter?: FilterExcludingWhere<Conversation>,
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
  async getUser(@param.path.string('id') id: typeof Conversation.prototype.id): Promise<User> {
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
  async getPost(@param.path.string('id') id: typeof Conversation.prototype.id): Promise<Post> {
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
    conversation.read = true;
    conversation.unreadMessage = 0;
    conversation.updatedAt = new Date().toString();
    await this.conversationRepository.updateById(id, conversation);
  }

  @del('/conversations/{id}')
  @response(204, {
    description: 'Conversation DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.conversationRepository.deleteById(id);
  }
}

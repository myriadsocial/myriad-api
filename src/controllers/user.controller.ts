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
import dotenv from 'dotenv';
import {PaginationInterceptor} from '../interceptors';
import {CustomFilter, User} from '../models';
import {UserRepository} from '../repositories';
// import {authenticate} from '@loopback/authentication';

dotenv.config();

// @authenticate("jwt")
export class UserController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
  ) {}

  @post('/users')
  @response(200, {
    description: 'User model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(User),
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['id', 'name'],
            properties: {
              id: {
                type: 'string',
              },
              name: {
                type: 'string',
              },
            },
          },
        },
      },
    })
    user: User,
  ): Promise<User> {
    const foundUser = await this.userRepository.findOne({
      where: {id: user.id},
    });

    if (foundUser) return foundUser;

    return this.userRepository.create(user);
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/users')
  @response(200, {
    description: 'Array of User model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(User),
        },
      },
    },
  })
  async find(
    @param.query.object('filter', getModelSchemaRef(CustomFilter)) filter: CustomFilter,
  ): Promise<User[]> {
    return this.userRepository.find(filter as Filter<User>);
  }

  @get('/users/{id}')
  @response(200, {
    description: 'User model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(User, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(User, {exclude: 'where'}) filter?: FilterExcludingWhere<User>,
  ): Promise<User> {
    return this.userRepository.findById(id, filter);
  }

  @patch('/users/{id}')
  @response(204, {
    description: 'User PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(User, {
            partial: true,
          }),
        },
      },
    })
    user: Partial<User>,
  ): Promise<void> {
    await this.userRepository.updateById(id, user);
  }

  @del('/users/{id}')
  @response(204, {
    description: 'User DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.userRepository.deleteById(id);
  }
}

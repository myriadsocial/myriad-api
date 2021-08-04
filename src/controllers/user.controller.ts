import {intercept, service} from '@loopback/core';
import {Filter, FilterExcludingWhere} from '@loopback/repository';
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
import {defaultFilterQuery} from '../helpers/filter-utils';
import {PaginationInterceptor} from '../interceptors';
import {User} from '../models';
import {CryptocurrencyService, FriendService} from '../services';
// import {authenticate} from '@loopback/authentication';

dotenv.config();

// @authenticate("jwt")

@intercept(PaginationInterceptor.BINDING_KEY)
export class UserController {
  constructor(
    @service(CryptocurrencyService)
    protected cryptocurrencyService: CryptocurrencyService,
    @service(FriendService)
    protected friendService: FriendService,
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
    const foundUser = await this.friendService.userRepository.findOne({
      where: {id: user.id},
    });

    if (foundUser) {
      foundUser.isOnline = true;

      this.updateById(foundUser.id, foundUser) as Promise<void>;

      return foundUser;
    }

    this.cryptocurrencyService.defaultAcalaTips(user.id) as Promise<void>;
    this.cryptocurrencyService.defaultCryptocurrency(user.id) as Promise<void>;

    user.username = user.name?.toLowerCase().replace(/\s+/g, '').trim();
    user.bio = `Hello, my name is ${user.name}!`;
    user.createdAt = new Date().toString();
    user.updatedAt = new Date().toString();

    return this.friendService.userRepository.create(user);
  }

  @get('/users/{id}/approved-friends')
  @response(200, {
    description: 'Array of approved friend list',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(User, {includeRelations: true}),
        },
      },
    },
  })
  async userFriendList(
    @param.path.string('id') id: string,
    @param.path.number('page') page: number,
    @param.filter(User, {exclude: ['where', 'skip', 'offset']}) filter?: Filter<User>,
  ): Promise<User[]> {
    const friendIds = await this.friendService.getApprovedFriendIds(id);

    filter = defaultFilterQuery(page, filter);

    return this.friendService.userRepository.find({
      ...filter,
      where: {
        id: {
          inq: friendIds,
        },
      },
    });
  }

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
    @param.query.number('page') page: number,
    @param.filter(User, {exclude: ['skip', 'offset']}) filter?: Filter<User>,
  ): Promise<User[]> {
    filter = defaultFilterQuery(page, filter);
    return this.friendService.userRepository.find(filter);
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
    user: User,
  ): Promise<void> {
    user.updatedAt = new Date().toString();
    await this.friendService.userRepository.updateById(id, user);
  }

  @del('/users/{id}')
  @response(204, {
    description: 'User DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.friendService.userRepository.deleteById(id);
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
    return this.friendService.userRepository.findById(id, filter);
  }
}

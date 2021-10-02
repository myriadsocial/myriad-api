import {intercept} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {
  get,
  getModelSchemaRef,
  HttpErrors,
  param,
  patch,
  post,
  requestBody,
  response,
} from '@loopback/rest';
import {ActivityLogType} from '../enums';
import {PaginationInterceptor} from '../interceptors';
import {User} from '../models';
import {ActivityLogRepository, UserRepository} from '../repositories';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class UserController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(ActivityLogRepository)
    protected activityLogRepository: ActivityLogRepository,
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
          schema: getModelSchemaRef(User, {
            title: 'NewUser',
            exclude: [
              'profilePictureURL',
              'bannerImageUrl',
              'fcmTokens',
              'onTimeline',
              'createdAt',
              'updatedAt',
              'deletedAt',
            ],
          }),
        },
      },
    })
    user: User,
  ): Promise<User> {
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
          items: getModelSchemaRef(User, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(User, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<User>,
  ): Promise<User[]> {
    return this.userRepository.find(filter);
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
            exclude: ['id', 'defaultCurrency', 'onTimeline', 'deletedAt'],
          }),
        },
      },
    })
    user: Partial<User>,
  ): Promise<void> {
    if (user.username) {
      const {count} = await this.activityLogRepository.count({
        userId: id,
        type: ActivityLogType.USERNAME,
      });

      if (count >= 1)
        throw new HttpErrors.UnprocessableEntity(
          'You can only updated username once',
        );

      await this.activityLogRepository.create({
        userId: id,
        type: ActivityLogType.USERNAME,
        message: 'You updated your username',
      });
    }

    await this.userRepository.updateById(id, user);
    await this.activityLogRepository.create({
      userId: id,
      type: ActivityLogType.PROFILE,
      message: 'You updated your profile',
    });
  }
}

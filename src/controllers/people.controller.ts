import {inject, intercept, service} from '@loopback/core';
import {
  AnyObject,
  Filter,
  FilterExcludingWhere,
  repository,
} from '@loopback/repository';
import {del, get, getModelSchemaRef, param, response} from '@loopback/rest';
import {PlatformType, FriendStatusType, PermissionKeys} from '../enums';
import {PaginationInterceptor} from '../interceptors';
import {People} from '../models';
import {PeopleRepository, UserRepository} from '../repositories';
import {authenticate, AuthenticationBindings} from '@loopback/authentication';
import {UserProfile, securityId} from '@loopback/security';
import {pull, orderBy} from 'lodash';
import {FriendService} from '../services';

@authenticate({strategy: 'jwt', options: {required: [PermissionKeys.ADMIN]}})
export class PeopleController {
  constructor(
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @service(FriendService)
    protected friendService: FriendService,
    @inject(AuthenticationBindings.CURRENT_USER)
    protected currentUser: UserProfile,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/people')
  @response(200, {
    description: 'Array of People model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(People, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(People, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<People>,
  ): Promise<People[]> {
    return this.peopleRepository.find(filter);
  }

  @get('/people/search')
  @response(200, {
    description: 'Array of People model instance',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(People),
        },
      },
    },
  })
  async searchPeople(@param.query.string('q') q?: string): Promise<People[]> {
    if (!q) return [];
    const pattern = new RegExp('^' + q, 'i');

    return this.friendService
      .getFriendIds(
        this.currentUser[securityId],
        FriendStatusType.BLOCKED,
        true,
      )
      .then(blockedIds => {
        return Promise.all([
          this.userRepository.find(<AnyObject>{
            where: {
              id: {nin: blockedIds},
              or: [
                {
                  name: {
                    regexp: pattern,
                  },
                },
                {
                  username: {
                    regexp: pattern,
                  },
                },
              ],
              deletedAt: {
                $eq: null,
              },
            },
            order: ['createdAt DESC'],
            limit: 10,
          }),
          this.peopleRepository.find(<AnyObject>{
            where: {
              or: [
                {
                  name: {
                    regexp: pattern,
                  },
                },
                {
                  username: {
                    regexp: pattern,
                  },
                },
              ],
              deletedAt: {
                $eq: null,
              },
            },
            include: ['userSocialMedia'],
            order: ['createdAt DESC'],
            limit: 10,
          }),
        ]);
      })
      .then(([users, p]) => {
        const userToPeople = pull(users).map(user => {
          return new People({
            id: user.id,
            name: user.name,
            username: user.username,
            platform: PlatformType.MYRIAD,
            originUserId: user.id,
            profilePictureURL: user.profilePictureURL,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          });
        });

        return orderBy([...userToPeople, ...p], ['createdAt'], ['desc']);
      });
  }

  @get('/people/{id}')
  @response(200, {
    description: 'People model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(People, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(People, {exclude: 'where'})
    filter?: FilterExcludingWhere<People>,
  ): Promise<People> {
    return this.peopleRepository.findById(id, filter);
  }

  @del('/people/{id}')
  @response(204, {
    description: 'People DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.peopleRepository.deleteById(id);
  }
}

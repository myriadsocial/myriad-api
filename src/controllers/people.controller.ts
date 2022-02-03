import {inject, intercept} from '@loopback/core';
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
import {
  FriendRepository,
  PeopleRepository,
  UserRepository,
} from '../repositories';
import {authenticate, AuthenticationBindings} from '@loopback/authentication';

import {UserProfile, securityId} from '@loopback/security';

@authenticate({strategy: 'jwt', options: {required: [PermissionKeys.ADMIN]}})
export class PeopleController {
  constructor(
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
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
    return this.getPeopleAndUser(q);
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

  async getPeopleAndUser(q?: string): Promise<People[]> {
    if (!q) return [];
    const pattern = new RegExp('^' + q, 'i');

    let users = await this.userRepository.find(<AnyObject>{
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
          $exists: false,
        },
      },
      order: ['createdAt DESC'],
      limit: 5,
    });

    const requesteeIds = users.map(e => e.id);
    const blockedFriends = await this.friendRepository.find({
      where: {
        or: [
          {
            requestorId: this.currentUser[securityId],
            requesteeId: {inq: requesteeIds},
            status: FriendStatusType.BLOCKED,
          },
          {
            requestorId: {inq: requesteeIds},
            requesteeId: this.currentUser[securityId],
            status: FriendStatusType.BLOCKED,
          },
        ],
      },
    });

    if (blockedFriends.length !== 0) {
      const requestorId = blockedFriends.map(e => e.requestorId);
      const requesteeId = blockedFriends.map(e => e.requesteeId);
      const blockedFriendIds = [...requestorId, ...requesteeId].filter(
        e => e !== this.currentUser[securityId],
      );

      users = users.filter(user => !blockedFriendIds.includes(user.id));
    }

    const userToPeople = users.map(user => {
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

    const people = await this.peopleRepository.find(<AnyObject>{
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
          $exists: false,
        },
      },
      include: ['userSocialMedia'],
      order: ['createdAt DESC'],
      limit: 10 - userToPeople.length,
    });

    return [...userToPeople, ...people];
  }
}

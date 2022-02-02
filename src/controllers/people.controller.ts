import {inject, intercept} from '@loopback/core';
import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {del, get, getModelSchemaRef, param, response} from '@loopback/rest';
import {PlatformType, FriendStatusType} from '../enums';
import {AuthorizeInterceptor, PaginationInterceptor} from '../interceptors';
import {People} from '../models';
import {
  FriendRepository,
  PeopleRepository,
  UserRepository,
} from '../repositories';
import {authenticate, AuthenticationBindings} from '@loopback/authentication';
import {UserProfile, securityId} from '@loopback/security';

@authenticate('jwt')
@intercept(AuthorizeInterceptor.BINDING_KEY)
export class PeopleController {
  constructor(
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    protected currentUser: UserProfile,
  ) {}

  @authenticate.skip()
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

  @authenticate.skip()
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

    let users = await this.userRepository.find({
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
      },
      order: ['createdAt DESC'],
      limit: 5,
    });

    const blockedFriends = await this.friendRepository.find({
      where: {
        or: [
          {
            requestorId: this.currentUser[securityId],
            requesteeId: {inq: users.map(e => e.id)},
            status: FriendStatusType.BLOCKED,
          },
          {
            requestorId: {inq: users.map(e => e.id)},
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

    const people = await this.peopleRepository.find({
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
      },
      include: ['userSocialMedia'],
      order: ['createdAt DESC'],
      limit: 10 - userToPeople.length,
    });

    return [...userToPeople, ...people];
  }
}

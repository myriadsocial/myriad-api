import {service} from '@loopback/core';
import {
  Filter,
  FilterExcludingWhere,
  repository
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  HttpErrors,
  param,
  patch,
  post,
  requestBody,
  response
} from '@loopback/rest';
import {Friend, User, DetailTransaction} from '../models';
import {
  ExperienceRepository, FriendRepository, PeopleRepository, PostRepository, QueueRepository,
  TransactionRepository, UserRepository, UserTokenRepository
} from '../repositories';
import {NotificationService} from '../services';
import { FriendId } from '../interfaces';
import dotenv from 'dotenv';
import {authenticate} from '@loopback/authentication';

dotenv.config()

// @authenticate("jwt")
export class UserController {
  constructor(
    @repository(UserRepository)
    public userRepository: UserRepository,
    @repository(ExperienceRepository)
    public experienceRepository: ExperienceRepository,
    @repository(PeopleRepository)
    public peopleRepository: PeopleRepository,
    @repository(QueueRepository)
    public queueRepository: QueueRepository,
    @repository(FriendRepository)
    public friendRepository: FriendRepository,
    @repository(PostRepository)
    public postRepository: PostRepository,
    @repository(UserTokenRepository)
    public userTokenRepository: UserTokenRepository,
    @repository(TransactionRepository)
    public transactionRepository: TransactionRepository,
    @service(NotificationService)
    public notificationService: NotificationService
  ) { }

  @post('/users')
  @response(200, {
    description: 'User model instance',
    content: {'application/json': {schema: getModelSchemaRef(User)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              id: {
                type: 'string'
              },
              name: {
                type: 'string'
              }
            }
          }
        },
      },
    })
    user: User,
  ): Promise<User> {
    const foundUser = await this.userRepository.findOne({
      where: {
        id: user.id
      }
    })

    if (foundUser) {
      this.updateById(foundUser.id, {
        is_online: true
      } as User)

      foundUser.is_online = true;

      return foundUser
    }

    const newUser = await this.userRepository.create({
      ...user,
      username: user.name?.toLowerCase().replace(/\s+/g,'').trim(),
      bio: user.bio ? user.bio : `Hello, my name is ${user.name[0].toUpperCase() + user.name.substring(1).toLowerCase()}!`,
      createdAt: new Date().toString(),
      updatedAt: new Date().toString()
    });

    this.userTokenRepository.create({
      userId: newUser.id,
      tokenId: 'MYR'
    })

    return newUser
  }

  @post('/users/{id}/friends')
  @response(200, {
    description: 'Request friends',
    content: {'application/json': {schema: getModelSchemaRef(Friend)}}
  })
  async createRequest(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              friendId: {
                type: 'string'
              }
            }
          }
        }
      }
    }) friend: FriendId
  ): Promise<Friend> {
    if (friend.friendId === id) {
      throw new HttpErrors.UnprocessableEntity('Cannot add itself')
    }

    const countFriend = await this.friendRepository.count({
      friendId: friend.friendId,
      requestorId: id,
      status: 'pending'
    })

    if (countFriend.count > 20) {
      throw new HttpErrors.UnprocessableEntity("Please approved your pending request, before add new friend!")
    }

    const foundFriend = await this.friendRepository.findOne({
      where: {
        friendId: friend.friendId,
        requestorId: id
      }
    })

    if (foundFriend && foundFriend.status === 'rejected') {
      this.friendRepository.updateById(foundFriend.id, {
        status: "pending",
        updatedAt: new Date().toString()
      })

      foundFriend.status = 'pending'
      foundFriend.updatedAt = new Date().toString()

      return foundFriend
    }

    if (foundFriend && foundFriend.status === 'approved') {
      throw new HttpErrors.UnprocessableEntity('You already friend with this user')
    }

    if (foundFriend && foundFriend.status === 'pending') {
      throw new HttpErrors.UnprocessableEntity('Please wait for this user to approved your request')
    }

    try {
      await this.notificationService.sendFriendRequest(id, friend.friendId);
    } catch (error) {
      // ignored
    }

    return this.friendRepository.create({
      createdAt: new Date().toString(),
      friendId: friend.friendId,
      requestorId: id
    })
  }

  @get('users/{id}/approved-friends')
  @response(200, {
    description: 'Array of approved friend list',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(User)
        }
      }
    }
  })
  async friendList(
    @param.path.string('id') id: string
  ): Promise<User> {
    const foundUser = await this.userRepository.findById(id);
    const friends = await this.friendRepository.find({
      where: {
        or: [
          {
            requestorId: id
          },
          {
            friendId: id
          }
        ],
        status: 'approved'
      }
    })

    const friendIds = friends.map(friend => friend.friendId);
    const requestorIds = friends.map(friend => friend.requestorId);
    const ids = [
      ...friendIds.filter(id => !requestorIds.includes(id)), 
      ...requestorIds
    ].filter(userId => userId != id);

    const users = await this.userRepository.find({
      where: {
        id: {
          inq: ids
        }
      }
    })
    
    foundUser.friends = users

    return foundUser
  }

  @get('users/{id}/friends')
  @response(200, {
    description: 'Array of friend request',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Friend)
        }
      }
    }
  })
  async requestList(
    @param.path.string('id') id: string,
    @param.query.string('status') status: string
  ): Promise<Friend[]> {
    const requestStatus = ["pending", "rejected", "approved", "all"];
    const found = requestStatus.find(req => req === status);

    if (!found && status) throw new HttpErrors.UnprocessableEntity("Please filled with corresponding status: all, pending, approved, or rejected")
    
    if ((typeof status === 'string' && !status) || status === 'all' || !status) {
      return this.friendRepository.find({
        where: {
          requestorId: id
        },
        include: [
          {
            relation: 'friend'
          },
          {
            relation: 'requestor'
          }
        ]
      })
    }

    return this.friendRepository.find({
      where: {
        requestorId: id,
        status: status
      },
      include: [
        {
          relation: 'friend'
        },
        {
          relation: 'requestor'
        }
      ]
    })
  }

  @get('/users/{id}/detail-transactions', {
    responses: {
      '200': {
        description: 'Array of User has many DetailTransaction',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(DetailTransaction)},
          },
        },
      },
    },
  })
  async findDetailTransaction(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<DetailTransaction>,
  ): Promise<DetailTransaction[]> {
    return this.userRepository.detailTransactions(id).find(filter);
  }

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
    @param.filter(User) filter?: Filter<User>,
  ): Promise<User[]> {
    return this.userRepository.find(filter);
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
          schema: getModelSchemaRef(User, {partial: true}),
        },
      },
    })
    user: User,
  ): Promise<void> {
    await this.userRepository.updateById(id, {
      ...user,
      updatedAt: new Date().toString(),
    });
  }

  @del('/users/{id}')
  @response(204, {
    description: 'User DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.userRepository.deleteById(id);
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
    @param.filter(User, {exclude: 'where'}) filter?: FilterExcludingWhere<User>
  ): Promise<User> {
    return this.userRepository.findById(id, filter);
  }

  @get('users/{username}/example-seed')
  @response(200, {
    description: 'Get seed instance'
  })
  async getSeed(
    @param.path.string('username') username: string
  ): Promise<object> {
    const getUser = await this.userRepository.findOne({
      where: {
        username: username
      }
    })

    if (getUser && getUser.seed_example) return {
      seed: getUser.seed_example
    }

    throw new HttpErrors.NotFound('Seed Not Found')
  }

  // async defaultExperience(user: User): Promise<void> {
  //   this.userRepository.savedExperiences(user.id).create({
  //     name: user.name + " Experience",
  //     tags: [
  //       {
  //         id: 'cryptocurrency',
  //         hide: false
  //       },
  //       {
  //         id: 'blockchain',
  //         hide: false
  //       },
  //       {
  //         id: 'technology',
  //         hide: false
  //       }
  //     ],
  //     people: [
  //       {
  //         username: "gavofyork",
  //         platform_account_id: "33962758",
  //         profile_image_url: "https://pbs.twimg.com/profile_images/981390758870683656/RxA_8cyN_400x400.jpg",
  //         platform: "twitter",
  //         hide: false
  //       },
  //       {
  //         username: "CryptoChief",
  //         platform_account_id: "t2_e0t5q",
  //         profile_image_url: "https://www.redditstatic.com/avatars/avatar_default_15_DB0064.png",
  //         platform: "reddit",
  //         hide: false
  //       }
  //     ],
  //     description: `Hello, ${user.name}! Welcome to myriad!`,
  //     userId: user.id,
  //     createdAt: new Date().toString(),
  //     updatedAt: new Date().toString()
  //   })
  // }
}

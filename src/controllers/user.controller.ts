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
import {Keyring} from '@polkadot/api';
import {u8aToHex} from '@polkadot/util';
import {encodeAddress} from '@polkadot/util-crypto';
import {KeypairType} from '@polkadot/util-crypto/types';
import {polkadotApi} from '../helpers/polkadotApi';
import {Friend, User} from '../models';
import {
  ExperienceRepository, FriendRepository, PeopleRepository, PostRepository, QueueRepository,
  TransactionRepository, UserRepository, UserTokenRepository
} from '../repositories';
import {NotificationService} from '../services';
import dotenv from 'dotenv';
import {authenticate} from '@loopback/authentication';
import { FriendId } from '../interfaces';

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
          schema: getModelSchemaRef(User, {
            title: 'NewUser',

          }),
        },
      },
    })
    user: User,
  ): Promise<User> {
    try {
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

      await this.defaultTips(user.id)

      const newUser = await this.userRepository.create({
        ...user,
        bio: user.bio ? user.bio : `Hello, my name is ${user.name}!`,
        createdAt: new Date().toString(),
        updatedAt: new Date().toString()
      });

      this.userRepository.detailTransactions(newUser.id).create({
        sentToMe: 100000000000000,
        sentToThem: 0,
        userId: newUser.id,
        tokenId: 'MYR'
      })

      this.userTokenRepository.create({
        userId: newUser.id,
        tokenId: 'MYR'
      })

      // await this.defaultExperience(newUser)

      return newUser
    } catch (err) {
      if (err.message === 'LostConnection') {
        throw new HttpErrors.UnprocessableEntity('Myriad RPC Lost Connection')
      }

      throw new HttpErrors.UnprocessableEntity('Error RPC');
    }
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

  @get('users/{id}/friends')
  @response(200, {
    description: 'Array of friend request',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Friend, {
            includeRelations: true
          })
        }
      }
    }
  })
  async requestList(
    @param.path.string('id') id: string,
    @param.query.string('status') status: string
  ): Promise<Friend[]> {
    const requestStatus = [
      "pending",
      "rejected",
      "approved",
      "all"
    ]

    const found = requestStatus.find(req => req === status)

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

  @get('users/{username}/example-seed/{id}')
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

  async defaultExperience(user: User): Promise<void> {
    this.userRepository.savedExperiences(user.id).create({
      name: user.name + " Experience",
      tags: [
        {
          id: 'cryptocurrency',
          hide: false
        },
        {
          id: 'blockchain',
          hide: false
        },
        {
          id: 'technology',
          hide: false
        }
      ],
      people: [
        {
          username: "gavofyork",
          platform_account_id: "33962758",
          profile_image_url: "https://pbs.twimg.com/profile_images/981390758870683656/RxA_8cyN_400x400.jpg",
          platform: "twitter",
          hide: false
        },
        {
          username: "CryptoChief",
          platform_account_id: "t2_e0t5q",
          profile_image_url: "https://www.redditstatic.com/avatars/avatar_default_15_DB0064.png",
          platform: "reddit",
          hide: false
        }
      ],
      description: `Hello, ${user.name}! Welcome to myriad!`,
      userId: user.id,
      createdAt: new Date().toString(),
      updatedAt: new Date().toString()
    })
  }

  async defaultTips(userId: string): Promise<void> {
    const provider = process.env.MYRIAD_WS_RPC || ""
    const myriadPrefix = Number(process.env.MYRIAD_ADDRESS_PREFIX)
    const api = await polkadotApi(provider)
    const keyring = new Keyring({
      type: process.env.MYRIAD_CRYPTO_TYPE as KeypairType,
      ss58Format: myriadPrefix
    });

    const mnemonic = process.env.MYRIAD_FAUCET_MNEMONIC ?? "";
    const from = keyring.addFromMnemonic(mnemonic);
    const to = encodeAddress(userId, myriadPrefix);
    const value = +(process.env.MYRIAD_ACCOUNT_DEPOSIT ?? 100000000000000)
    const {nonce} = await api.query.system.account(from.address)

    const foundQueue = await this.queueRepository.findOne({where: {id: 'admin'}})

    let count: number = nonce.toJSON()

    if (!foundQueue) {
      const queue = await this.queueRepository.create({
        id: 'admin',
        count
      })

      await this.queueRepository.updateById(queue.id, {count: count + 1})
    } else {
      if (foundQueue.count >= nonce.toJSON()) {
        count = foundQueue.count
      } else {
        count = nonce.toJSON()
      }

      await this.queueRepository.updateById(foundQueue.id, {count: count + 1})
    }

    const transfer = api.tx.balances.transfer(to, value);
    const txhash = await transfer.signAndSend(from, {nonce: count});

    this.transactionRepository.create({
      trxHash: txhash.toString(),
      from: u8aToHex(from.publicKey),
      to: userId,
      value: value,
      state: 'success',
      hasSendToUser: true,
      createdAt: new Date().toString(),
      tokenId: 'MYR'
    })
    await api.disconnect()
  }
}

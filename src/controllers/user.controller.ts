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
import {KeypairType} from '@polkadot/util-crypto/types';
import {polkadotApi} from '../helpers/polkadotApi';
import {User,Friend} from '../models';
import {
  ExperienceRepository,
  PeopleRepository,
  QueueRepository,
  TagRepository,
  UserRepository,
  FriendRepository,
  PostRepository
} from '../repositories';

export class UserController {
  constructor(
    @repository(UserRepository)
    public userRepository: UserRepository,
    @repository(ExperienceRepository)
    public experienceRepository: ExperienceRepository,
    @repository(TagRepository)
    public tagRepository: TagRepository,
    @repository(PeopleRepository)
    public peopleRepository: PeopleRepository,
    @repository(QueueRepository)
    public queueRepository: QueueRepository,
    @repository(FriendRepository) public friendRepository: FriendRepository,
    @repository(PostRepository) public postRepository: PostRepository
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
    user.name = user.name.replace(/\s\s+/g, ' ')
      .trim().split(' ').map(word => {
        return word[0].toUpperCase() + word.substr(1).toLowerCase()
      }).join(' ')

    try {
      const foundUser = await this.userRepository.findOne({
        where: {
          or: [
            {id: user.id},
            {name: user.name}
          ]
        }
      })

      if (!foundUser) {
        const api = await polkadotApi()
        const keyring = new Keyring({
          type: process.env.POLKADOT_CRYPTO_TYPE as KeypairType,
          ss58Format: Number(process.env.POLKADOT_KEYRING_PREFIX)
        });
        const mnemonic = 'chalk cargo recipe ring loud deputy element hole moral soon lock credit';
        const from = keyring.addFromMnemonic(mnemonic);
        const to = user.id;
        const value = 100000000000000; // send 100 myria
        const {nonce} = await api.query.system.account(from.address)

        let count: number = nonce.toJSON()

        const foundQueue = await this.queueRepository.findOne({where: {id: 'admin'}})

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
        await transfer.signAndSend(from, {nonce: count});
        await api.disconnect()
      } else throw new Error('UserExist')

      const newUser = await this.userRepository.create({
        ...user,
        bio: user.bio ? user.bio : `Hello, my name is ${user.name}!`,
        createdAt: new Date().toString(),
        updatedAt: new Date().toString()
      });

      await this.defaultPost(newUser.id)
      // await this.defaultExperience(newUser)

      return newUser
    } catch (err) {
      if (err.message === 'LostConnection') {
        throw new HttpErrors.UnprocessableEntity('Myriad RPC Lost Connection')
      }

      throw new HttpErrors.UnprocessableEntity('User already exists');
    }
  }

  @post('/users/{id}/friends')
  @response(200, {
    description: 'Request friends'
  })
  async createRequest(
    @param.path.string('id') id: string,
    @requestBody() friend: {friendId: string}
  ):Promise<Friend> {
    if (friend.friendId === id) {
      throw new HttpErrors.UnprocessableEntity('Cannot add itself')
    }

    const foundFriend = await this.friendRepository.findOne({
      where: {
        status: "rejected",
        friendId: friend.friendId,
        requestorId: id
      }
    })

    if (foundFriend) {
      this.friendRepository.updateById(foundFriend.id, {
        status: "pending"
      })

      foundFriend.status = 'pending'

      return foundFriend
    }

    return this.friendRepository.create({
      createdAt: new Date().toString(),
      friendId: friend.friendId,
      requestorId: id
    })
  }

  @get('users/{id}/friends')
  @response(200, {
    description: 'Array of pending friend request'
  })
  async requestList(
    @param.path.string('id') id: string,
    @param.query.string('status') status: string
  ):Promise<Friend[]> {
    console.log(typeof status)
    console.log(status, 'status')
    console.log(status.length)
    const requestStatus = [
      "pending",
      "rejected",
      "accepted"
    ]

    const found = requestStatus.find(req => req === status)

    if (!found) throw new HttpErrors.UnprocessableEntity("Available status: pending, accepted, rejected")

    return this.friendRepository.find({
      where: {
        requestorId: id,
        status: status
      },
      include: [
        {
          relation: 'friend'
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

  async defaultPost (userId:string):Promise<void> {
    const textIds = [
      "1385108424761872387",
      "1385164896896225282",
      "1027306774356025345",
      "ms508t",
      "fy9zev",
      "463517661740029",
      "10157789183586961"
    ]

    const posts = await this.postRepository.find({
      where: {
        textId: {
          inq: textIds
        }
      }
    })

    for (let i = 0; i < posts.length; i++) {
      await this.postRepository.updateById(posts[i].id, {
        importBy: [
          ...posts[i].importBy,
          userId
        ]
      })
    }
  }

  async defaultExperience(user: User):Promise<void> {
    await this.userRepository.savedExperiences(user.id).create({
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
}

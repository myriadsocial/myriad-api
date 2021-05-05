import {
  Filter,
  FilterExcludingWhere,
  repository
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,





  HttpErrors, param,
  patch,
  post,
  requestBody,
  response
} from '@loopback/rest';
import {Keyring} from '@polkadot/api';
import { KeypairType } from '@polkadot/util-crypto/types';
import {polkadotApi} from '../helpers/polkadotApi';
import {User} from '../models';
import {ExperienceRepository, PeopleRepository, QueueRepository, TagRepository, UserRepository} from '../repositories';

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
    public queueRepository: QueueRepository
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

    const foundUser = await this.userRepository.findOne({
      where: {
        or: [
          {id: user.id},
          {name: user.name}
        ]
      }
    })

    try {
      const api = await polkadotApi()

      if (!foundUser) {
        let count: number = 0

        const foundQueue = await this.queueRepository.findOne({where: {id: 'admin'}})
        const keyring = new Keyring({
          type: process.env.POLKADOT_CRYPTO_TYPE as KeypairType, 
          ss58Format: Number(process.env.POLKADOT_KEYRING_PREFIX)
        });
        const mnemonic = 'chalk cargo recipe ring loud deputy element hole moral soon lock credit';
        const from = keyring.addFromMnemonic(mnemonic);
        const to = user.id;
        const value = 100000000000000; // send 100 myria
        const {nonce} = await api.query.system.account(from.address)

        if (!foundQueue) {
          count = nonce.toJSON()

          const queue = await this.queueRepository.create({
            id: 'admin',
            count
          })

          await this.queueRepository.updateById(queue.id, {count: count + 1})
        } else {
          count = foundQueue.count

          await this.queueRepository.updateById(foundQueue.id, {count: count + 1})
        }

        const transfer = api.tx.balances.transfer(to, value);
        await transfer.signAndSend(from, {nonce: count});
        await api.disconnect()
      } else throw new Error('UserExists')

      const newUser = await this.userRepository.create({
        ...user,
        bio: user.bio ? user.bio : `Hello, my name is ${user.name}!`,
        createdAt: new Date().toString(),
        updatedAt: new Date().toString()
      });

      await this.userRepository.savedExperiences(newUser.id).create({
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
            platform: "twitter",
            hide: false
          },
          {
            username: "CryptoChief",
            platform_account_id: "t2_e0t5q",
            platform: "reddit",
            hide: false
          }
        ],
        description: `Hello, ${user.name}! Welcome to myriad!`,
        userId: newUser.id,
        createdAt: new Date().toString(),
        updatedAt: new Date().toString()
      })

      return newUser
    } catch (err) {
      if (err.message === 'LostConnection') {
        throw new HttpErrors.UnprocessableEntity('Myriad RPC Lost Connection')
      }

      throw new HttpErrors.UnprocessableEntity('User already exists');
    }
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

  // @get('/users/count')
  // @response(200, {
  //   description: 'User model count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async count(
  //   @param.where(User) where?: Where<User>,
  // ): Promise<Count> {
  //   return this.userRepository.count(where);
  // }

  // @patch('/users')
  // @response(200, {
  //   description: 'User PATCH success count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async updateAll(
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(User, {partial: true}),
  //       },
  //     },
  //   })
  //   user: User,
  //   @param.where(User) where?: Where<User>,
  // ): Promise<Count> {
  //   return this.userRepository.updateAll(user, where);
  // }

  // @put('/users/{id}')
  // @response(204, {
  //   description: 'User PUT success',
  // })
  // async replaceById(
  //   @param.path.string('id') id: string,
  //   @requestBody() user: User,
  // ): Promise<void> {
  //   await this.userRepository.replaceById(id, user);
  // }

}

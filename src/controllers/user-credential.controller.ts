import {inject} from '@loopback/core';
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
import {encodeAddress} from '@polkadot/keyring';
import {u8aToHex} from '@polkadot/util';
import {KeypairType} from '@polkadot/util-crypto/types';
import {polkadotApi} from '../helpers/polkadotApi';
import {TransactionWithRelations, UserCredential} from '../models';
import {
  DetailTransactionRepository, PeopleRepository,TokenRepository, TransactionRepository, UserCredentialRepository,
} from '../repositories';
import {Facebook, Reddit, Rsshub, Twitter} from '../services';

interface User {
  platform_account_id?: string,
  username: string,
  platform: string,
  profile_image_url?: string
}

export class UserCredentialController {
  constructor(
    @repository(UserCredentialRepository)
    public userCredentialRepository: UserCredentialRepository,
    @repository(PeopleRepository)
    public peopleRepository: PeopleRepository,
    @repository(DetailTransactionRepository) public detailTransactionRepository: DetailTransactionRepository,
    @repository(TransactionRepository) public transactionRepository: TransactionRepository,
    @repository(TokenRepository) public tokenRepository: TokenRepository,
    @inject('services.Twitter') protected twitterService: Twitter,
    @inject('services.Reddit') protected redditService: Reddit,
    @inject('services.Facebook') protected facebookService: Facebook,
  ) { }

  @post('/user-credentials')
  @response(200, {
    description: 'UserCredential model instance',
    content: {'application/json': {schema: getModelSchemaRef(UserCredential)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserCredential, {
            title: 'NewUserCredential',

          }),
        },
      },
    })
    userCredential: UserCredential,
  ): Promise<UserCredential> {
    return this.userCredentialRepository.create(userCredential)
  }

  @post('/verify')
  @response(200, {
    description: 'Verify User'
  })
  async verifyUser(
    @requestBody() verifyUser: {publicKey: string, username: string, platform: string}
  ): Promise<Boolean> {
    const {publicKey, platform, username} = verifyUser

    switch (platform) {
      case 'twitter':
        const {data: user} = await this.twitterService.getActions(`users/by/username/${username}?user.fields=profile_image_url`)

        if (!user) throw new HttpErrors.NotFound('Invalid username')

        const {data: tweets} = await this.twitterService.getActions(`users/${user.id}/tweets?max_results=5`)

        const foundTwitterPublicKey = tweets[0].text.split(' ').find((tweet: string) => tweet === publicKey)

        if (!foundTwitterPublicKey) throw new HttpErrors.NotFound('Cannot find specified post')

        const twitterCredential = await this.createCredential({
          platform_account_id: user.id,
          platform: platform,
          username: user.username,
          profile_image_url: user.profile_image_url ? user.profile_image_url.replace('normal', '400x400') : ''
        }, publicKey)

        this.transferTipsToUser(twitterCredential)

        // const statusTransfer = await this.transferTipsToUser(twitterCredential, user.id)

        // if(!statusTransfer) throw new HttpErrors.NotFound('RPC Lost Connection')

        this.fetchFollowing(user.id)

        return true

      case 'reddit':
        const {data: redditUser} = await this.redditService.getActions(`user/${username}/about.json`)

        const {data: foundRedditPost} = await this.redditService.getActions(`user/${username}/.json?limit=1`)

        if (foundRedditPost.children.length === 0) throw new HttpErrors.NotFound('Cannot find the spesified post')

        const foundRedditPublicKey = foundRedditPost.children[0].data.title.split(' ').find((post: string) => post === publicKey)

        if (!foundRedditPublicKey) throw new HttpErrors.NotFound('Cannot find specified post')

        const redditCredential = await this.createCredential({
          platform_account_id: 't2_' + redditUser.id,
          platform: 'reddit',
          username: redditUser.name,
          profile_image_url: redditUser.icon_img ? redditUser.icon_img.split('?')[0] : ''
        }, publicKey)

        this.transferTipsToUser(redditCredential)

        // const statusTransferReddit = await this.transferTipsToUser(redditCredential, 't2_' + redditUser.id)

        // if (!statusTransferReddit) throw new HttpErrors.NotFound('RPC Lost Connection')

        return true

      case 'facebook':
        const split = username.split('/')
        const fbUsername = split[3]
        const postId = split[5]

        const data = await this.facebookService.getActions(fbUsername, postId)
        const foundIndex = data.search(publicKey)
        const foundPublicKey = data.substring(foundIndex, foundIndex + 50)

        if (foundIndex === -1) throw new HttpErrors.NotFound('Cannot find specified post - found index')
        if (foundPublicKey.replace('"', '').trim() !== publicKey) throw new HttpErrors.NotFound('Cannot find specified post')

        const facebookCredential = await this.createCredentialFB({
          platform: 'facebook',
          username: fbUsername,
        }, publicKey)

        this.transferTipsToUser(facebookCredential);

        // const statusTransferFacebook = await this.transferTipsToUser(facebookCredential, fbUsername)

        // if (!statusTransferFacebook) throw new HttpErrors.NotFound('RPC Lost Connection')

        return true

      default:
        throw new HttpErrors.NotFound('Platform does not exist')
    }
  }

  @get('/user-credentials')
  @response(200, {
    description: 'Array of UserCredential model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(UserCredential, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(UserCredential) filter?: Filter<UserCredential>,
  ): Promise<UserCredential[]> {
    return this.userCredentialRepository.find(filter);
  }

  @get('/user-credentials/{id}')
  @response(200, {
    description: 'UserCredential model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(UserCredential, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(UserCredential, {exclude: 'where'}) filter?: FilterExcludingWhere<UserCredential>
  ): Promise<UserCredential> {
    return this.userCredentialRepository.findById(id, filter);
  }

  @patch('/user-credentials/{id}')
  @response(204, {
    description: 'UserCredential PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(UserCredential, {partial: true}),
        },
      },
    })
    userCredential: UserCredential,
  ): Promise<void> {
    await this.userCredentialRepository.updateById(id, userCredential);
  }

  @del('/user-credentials/{id}')
  @response(204, {
    description: 'UserCredential DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.userCredentialRepository.deleteById(id);
  }

  async transferTipsToUser(credential: UserCredential): Promise<void> {
    const keyring = new Keyring({
      type: process.env.POLKADOT_CRYPTO_TYPE as KeypairType,
    });
    const from = keyring.addFromUri('//' + credential.peopleId);
    const gasFee = 125000147
    const to = credential.userId
    const totalToken = await this.tokenRepository.count()

    for (let i = 0; i < totalToken.count; i++) {
      const token = (await this.tokenRepository.find({
        limit: 1,
        skip: i
      }))[0]

      const tokenId = token.id
      const rpc_address = token.rpc_address
      const address_format = token.address_format

      const totalTransaction = await this.transactionRepository.count({
        to: u8aToHex(from.publicKey),
        hasSendToUser: false,
        tokenId: tokenId
      })

      try {
        if (!totalTransaction) throw new Error("No transactions")

        const api = await polkadotApi(rpc_address);

        for (let j = 0; j < totalTransaction.count; j++) {
          const transaction = (await this.transactionRepository.find({
            where: {
              to: u8aToHex(from.publicKey),
              hasSendToUser: false,
              tokenId: tokenId
            },
            limit: 1,
            skip: j
          }))[0]

          const encodeTo = encodeAddress(to, address_format)
          const {data: balance} = await api.query.system.account(from.publicKey)

          if (balance.free.toNumber()) {
            const transfer = api.tx.balances.transfer(encodeTo, Number(transaction.value - gasFee))
            const txHash = await transfer.signAndSend(from)

            this.transactionRepository.updateById(transaction.id, {
              hasSendToUser: true
            })

            this.transactionRepository.create({
              trxHash: txHash.toString(),
              from: transaction.from,
              to: to,
              value: transaction.value - gasFee,
              state: "success",
              tokenId: token.id,
              hasSendToUser: true
            })

            const foundDetailTransaction = await this.detailTransactionRepository.findOne({
              where: {
                userId: to
              }
            })

            if (foundDetailTransaction) {
              this.detailTransactionRepository.updateById(foundDetailTransaction.id, {
                sentToMe: foundDetailTransaction.sentToMe + (balance.free.toNumber() - gasFee)
              })
            }
          }
        }

        await api.disconnect()
      } catch (err) { }
    }
  }

  async createCredentialFB(user: User, publicKey: string): Promise<UserCredential> {
    const credentials = await this.userCredentialRepository.find({
      where: {
        userId: publicKey
      }
    })

    for (let i = 0; i < credentials.length; i++) {
      const person = await this.peopleRepository.findOne({
        where: {
          id: credentials[i].peopleId
        }
      })

      if (person && person.platform === user.platform) {
        if (person.username !== user.username) {
          throw new HttpErrors.NotFound(`This ${person.platform} does not belong to you!`)
        }
      }
    }

    const foundPeople = await this.peopleRepository.findOne({
      where: {
        username: user.username,
        platform: user.platform
      }
    })

    if (foundPeople) {
      const foundCredential = await this.userCredentialRepository.findOne({
        where: {
          peopleId: foundPeople.id
        }
      })

      if (!foundCredential) {
        return this.peopleRepository.userCredential(foundPeople.id).create({
          userId: publicKey,
          isLogin: true
        })
      }

      if (foundCredential.userId === publicKey) {
        this.userCredentialRepository.updateById(foundCredential.id, {
          isLogin: true
        })

        foundCredential.isLogin = true

        return foundCredential
      }

      throw new HttpErrors.NotFound('Credential not valid')
    }

    const newPeople = await this.peopleRepository.create({
      username: user.username,
      platform: user.platform,
    })

    return this.peopleRepository.userCredential(newPeople.id).create({
      userId: publicKey,
      isLogin: true
    })
  }

  async createCredential(user: User, publicKey: string): Promise<UserCredential> {
    // Verify credential
    const credentials = await this.userCredentialRepository.find({
      where: {
        userId: publicKey
      }
    })

    for (let i = 0; i < credentials.length; i++) {
      const person = await this.peopleRepository.findOne({
        where: {
          id: credentials[i].peopleId
        }
      })

      if (person && person.platform === user.platform) {
        if (person.platform_account_id !== user.platform_account_id) {
          throw new HttpErrors.NotFound(`This ${person.platform} does not belong to you!`)
        }
      }
    }

    const foundPeople = await this.peopleRepository.findOne({
      where: {
        platform_account_id: user.platform_account_id,
        platform: user.platform
      }
    })

    if (foundPeople) {
      const foundCredential = await this.userCredentialRepository.findOne({
        where: {
          peopleId: foundPeople.id
        }
      })

      if (!foundCredential) {
        return this.peopleRepository.userCredential(foundPeople.id).create({
          userId: publicKey,
          isLogin: true
        })
      }

      if (foundCredential.userId === publicKey) {
        this.userCredentialRepository.updateById(foundCredential.id, {
          isLogin: true
        })

        foundCredential.isLogin = true

        return foundCredential
      }

      throw new HttpErrors.NotFound('Credential not valid')
    }

    const newPeople = await this.peopleRepository.create({
      username: user.username,
      platform_account_id: user.platform_account_id,
      platform: user.platform,
      profile_image_url: user.profile_image_url
    })

    return this.peopleRepository.userCredential(newPeople.id).create({
      userId: publicKey,
      isLogin: true
    })
  }

  async fetchFollowing(platform_account_id: string): Promise<void> {
    const {data: following} = await this.twitterService.getActions(`users/${platform_account_id}/following?user.fields=profile_image_url`)

    for (let i = 0; i < following.length; i++) {
      const person = following[i]
      const foundPerson = await this.peopleRepository.findOne({
        where: {
          platform_account_id: person.id
        }
      })

      if (!foundPerson) {
        this.peopleRepository.create({
          username: person.username,
          platform_account_id: person.id,
          profile_image_url: person.profile_image_url.replace('normal', '400x400'),
          platform: 'twitter',
          hide: false,
        })
      }
    }
  }

  groupByToken(transactions: TransactionWithRelations[]) {
    const groupByToken: any = {}

    for (let j = 0; j < transactions.length; j++) {
      if (groupByToken[transactions[j].token.rpc_address] === undefined) {
        groupByToken[transactions[j].token.rpc_address] = []
      }

      groupByToken[transactions[j].token.rpc_address].push(transactions[j])
    }

    return groupByToken
  }
}

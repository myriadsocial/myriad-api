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
import {UserCredential, VerifyUser} from '../models';
import {PeopleRepository, PostRepository, UserCredentialRepository, UserRepository} from '../repositories';
import {Reddit, Rsshub, Twitter, Facebook} from '../services';
import {polkadotApi} from '../helpers/polkadotApi'
import {Keyring} from '@polkadot/api'
import { KeypairType } from '@polkadot/util-crypto/types';

interface User {
  id: string,
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
    @repository(PostRepository)
    public postRepository: PostRepository,
    @repository(UserRepository) public userRepository: UserRepository,
    @inject('services.Twitter') protected twitterService: Twitter,
    @inject('services.Reddit') protected redditService: Reddit,
    @inject('services.Rsshub') protected rsshubService: Rsshub,
    @inject('services.Facebook') protected facebookService: Facebook
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
    @requestBody() verifyUser: {publicKey:string, platform:string}
  ):Promise<Boolean> {
    const {publicKey, platform} = verifyUser

    this.wait(15000)
    
    switch(platform) {
      case 'twitter':
        const {data: foundTweet, includes} = await this.twitterService.getActions(`tweets/search/recent?expansions=author_id&user.fields=id,name,username,profile_image_url&query=${publicKey}`)

        if (!foundTweet) return false

        const user = includes.users[0]

        await this.createCredential({
          id: user.id,
          platform: 'twitter',
          username: user.username,
          profile_image_url: user.profile_image_url
        }, publicKey)
        
        await this.transferTipsToUser(publicKey, user.id)
        
        return true

      case 'reddit':
        const {data: foundRedditPost} = await this.redditService.getActions(`search.json?q=${publicKey}&sort=new`)

        if (foundRedditPost.children.length === 0) return false

        const {data:redditUser} = await this.redditService.getActions(`user/${foundRedditPost.children[0].author}/about.json`)

        await this.createCredential({
          id: 't2_' + redditUser.id,
          platform: 'reddit',
          username: redditUser.name,
          profile_image_url: redditUser.icon_img ? redditUser.icon_img.split('?')[0] : ''
        }, publicKey)

        await this.transferTipsToUser(publicKey, 't2_' + redditUser.id)

        return true

      default:
        return false
    }
  }

  @post('/user-credentials/verify')
  @response(200, {
    desciption: `Verify User`,
    content: {'application/json': {schema: getModelSchemaRef(VerifyUser)}},
  })
  async verify(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(VerifyUser, {
            title: 'NewVerifyUser',

          }),
        },
      },
    }) verifyUser: VerifyUser
  ): Promise<Boolean> {
    const {userId, peopleId} = verifyUser

    try {
      const foundPeople = await this.peopleRepository.findOne({where: {id: peopleId}})
      const foundCredential = await this.userCredentialRepository.findOne({where: {userId, peopleId}})

      if (!foundPeople) return false
      if (!foundCredential) return false

      const {username, platform_account_id, platform} = foundPeople

      switch (platform) {
        case "twitter":
          const {data: tweets} = await this.twitterService.getActions(`users/${platform_account_id}}/tweets?max_results=5`)
          const twitterPublicKey = tweets[0].text.replace(/\n/g, ' ').split(' ')[7]

          if (userId === twitterPublicKey) {
            await this.transferEscorwToUser(peopleId, userId)

            return true
          }

          await this.userCredentialRepository.deleteById(foundCredential.id)

          return false

        case "reddit":
          const {data: redditPosts} = await this.redditService.getActions(`u/${username}.json?limit=1`)
          const redditPublicKey = redditPosts.children[0].data.title.replace(/n/g, ' ').split(' ')[7]
          
          if (userId === redditPublicKey) {
            await this.transferEscorwToUser(peopleId, userId)
            return true
          }
          
          await this.userCredentialRepository.deleteById(foundCredential.id)

          return false

        case "facebook":
          let facebookPublicKey = null

          const {data: facebookPosts} = await this.facebookService.getActions(platform_account_id, '')
          const publicKey = "Saying hi to #MyriadNetwork Public Key: "
          const indexFBPublicKey = facebookPosts.search(publicKey)

          if (indexFBPublicKey >= 0) {
            const index = indexFBPublicKey + publicKey.length
            facebookPublicKey = facebookPosts.substring(index, index + 49)
          }

          if (userId === facebookPublicKey) {
            await this.transferEscorwToUser(peopleId, userId)
            return true
          }
          
          await this.userCredentialRepository.deleteById(foundCredential.id)

          return false

        default:
          return false
      }
    } catch (err) {
      return false
    }
  }

  // @get('/user-credentials/count')
  // @response(200, {
  //   description: 'UserCredential model count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async count(
  //   @param.where(UserCredential) where?: Where<UserCredential>,
  // ): Promise<Count> {
  //   return this.userCredentialRepository.count(where);
  // }

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

  // @patch('/user-credentials')
  // @response(200, {
  //   description: 'UserCredential PATCH success count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async updateAll(
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(UserCredential, {partial: true}),
  //       },
  //     },
  //   })
  //   userCredential: UserCredential,
  //   @param.where(UserCredential) where?: Where<UserCredential>,
  // ): Promise<Count> {
  //   return this.userCredentialRepository.updateAll(userCredential, where);
  // }

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

  // @put('/user-credentials/{id}')
  // @response(204, {
  //   description: 'UserCredential PUT success',
  // })
  // async replaceById(
  //   @param.path.string('id') id: string,
  //   @requestBody() userCredential: UserCredential,
  // ): Promise<void> {
  //   await this.userCredentialRepository.replaceById(id, userCredential);
  // }

  @del('/user-credentials/{id}')
  @response(204, {
    description: 'UserCredential DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.userCredentialRepository.deleteById(id);
  }

  async transferEscorwToUser(peopleId:string, userId:string): Promise<void> {
    const posts = await this.postRepository.find({
      where: {
        peopleId,
        walletAddress: {
          neq: userId
        }
      }
    })

    const api = await polkadotApi()
    const keyring = new Keyring({
      type: process.env.POLKADOT_CRYPTO_TYPE as KeypairType, 
      ss58Format: Number(process.env.POLKADOT_KEYRING_PREFIX)
    });
    const gasFee = 125000147

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i]
      const from = keyring.addFromUri('//' + post.id)
      const to = userId
      const {data:balance} = await api.query.system.account(from.address)

      if (balance.free.toNumber()) {
        const transfer = api.tx.balances.transfer(to, balance.free.toNumber() - gasFee)

        await transfer.signAndSend(from)
      }

      console.log(i)
    }

    await api.disconnect()
  }

  async transferTipsToUser(publicKey: string, platformAccountId:string):Promise<void> {
    const posts = await this.postRepository.find({
      where: {
        walletAddress: {
          neq: publicKey
        }
      }
    })

    const userPost = posts.filter(post => {
      if (post.platformUser) {
        return platformAccountId === post.platformUser.platform_account_id
      }

      return false
    })

    const api = await polkadotApi()
    const keyring = new Keyring({
      type: process.env.POLKADOT_CRYPTO_TYPE as KeypairType, 
      ss58Format: Number(process.env.POLKADOT_KEYRING_PREFIX)
    });
    const gasFee = 125000147
    const to = publicKey

    for (let i = 0; i < userPost.length; i++) {
      const post = userPost[i]
      const from = keyring.addFromUri('//' + post.id)
      const {data:balance} = await api.query.system.account(from.address)

      if (balance.free.toNumber()) {
        const transfer = api.tx.balances.transfer(to, balance.free.toNumber() - gasFee)

        await transfer.signAndSend(from)
      }
    }

    await api.disconnect()
  }

  async createCredential(user: User, publicKey:string):Promise<void> {
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
        throw new HttpErrors.UnprocessableEntity(`This ${person.platform} does not belong to you!`)
      }
    }

    const foundPeople = await this.peopleRepository.findOne({
      where: {
        platform_account_id: user.id,
        platform: user.platform
      }
    })

    if (foundPeople) {
      const foundCredential = credentials.find(credential => credential.peopleId === foundPeople.id)

      if (!foundCredential) {
        await this.peopleRepository.userCredential(foundPeople.id).create({
          userId: publicKey,
          isLogin: true
        })
      } else {
        await this.userCredentialRepository.updateById(foundCredential.id, {
          isLogin: true
        })
      }
    } else {
      const newPeople = await this.peopleRepository.create({
        username: user.username,
        platform_account_id: user.id,
        platform: user.platform,
        profile_image_url: user.profile_image_url ? user.profile_image_url.replace('normal', '400x400') : ''
      })
      await this.peopleRepository.userCredential(newPeople.id).create({
        userId: publicKey,
        isLogin: true
      })
    }
  }

  wait (milliseconds:number) {
    const start = new Date().getTime();

    for (let i = 0; i < 1e7; i++) {
      if ((new Date().getTime() - start) > milliseconds) {
        break;
      }
    }
  }
}

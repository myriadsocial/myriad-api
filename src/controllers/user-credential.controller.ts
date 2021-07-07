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
import {WsProvider, ApiPromise , Keyring} from '@polkadot/api';
import {encodeAddress} from '@polkadot/keyring';
import {u8aToHex} from '@polkadot/util';
import {KeypairType} from '@polkadot/util-crypto/types';
import {polkadotApi} from '../helpers/polkadotApi';
import {UserCredential} from '../models';
import {
  DetailTransactionRepository, PeopleRepository,TokenRepository, TransactionRepository, UserCredentialRepository,
  UserTokenRepository
} from '../repositories';
import {Facebook, Reddit, Twitter} from '../services';
import {User, VerifyUser} from '../interfaces'
import dotenv from 'dotenv';
import {options} from "@acala-network/api";
import {authenticate} from '@loopback/authentication';
import {ApiOptions} from '@polkadot/api/types';
// import {AugmentedQueries} from '@polkadot/api/types/storage';
import '@acala-network/types/interfaces/augment-api';
dotenv.config();

// @authenticate("jwt")
export class UserCredentialController {
  constructor(
    @repository(UserCredentialRepository)
    public userCredentialRepository: UserCredentialRepository,
    @repository(PeopleRepository)
    public peopleRepository: PeopleRepository,
    @repository(DetailTransactionRepository) public detailTransactionRepository: DetailTransactionRepository,
    @repository(TransactionRepository) public transactionRepository: TransactionRepository,
    @repository(TokenRepository) public tokenRepository: TokenRepository,
    @repository(UserTokenRepository) public userTokenRepository: UserTokenRepository,
    @inject('services.Twitter') protected twitterService: Twitter,
    @inject('services.Reddit') protected redditService: Reddit,
    @inject('services.Facebook') protected facebookService: Facebook,
  ) { }

  @post('/verify')
  @response(200, {
    description: 'Verify User',
    content: {
      'application/json': {
        schema: {
          type: 'boolean'
        }
      }
    }
  })
  async verifyUser(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              publicKey: {
                type: 'string'
              },
              username: {
                type: 'string'
              },
              platform: {
                type: 'string'
              }
            }
          }
        }
      }
    }) verifyUser: VerifyUser
  ): Promise<Boolean> {
    const {publicKey, platform, username} = verifyUser;

    switch (platform) {
      case 'twitter':
        // Fetch data user from twitter api
        const twitterUser = await this.twitter(username, publicKey);

        // Add new credential
        const twitterCredential = await this.createCredential(twitterUser);

        return this.transferTips(twitterCredential);

        // const statusTransfer = await this.transferTipsToUser(twitterCredential, twitterUser.id)

        // if(!statusTransfer) throw new HttpErrors.NotFound('RPC Lost Connection')

        // if (twitterUser.id) this.fetchFollowing(twitterUser.id);

        // return true

      case 'reddit':
        const redditUser = await this.reddit(username, publicKey);
        
        // Add new credential
        const redditCredential = await this.createCredential(redditUser)

        // this.transferTipsToUser(redditCredential)

        // const statusTransferReddit = await this.transferTipsToUser(redditCredential, 't2_' + redditUser.id)

        // if (!statusTransferReddit) throw new HttpErrors.NotFound('RPC Lost Connection')

        return this.transferTips(redditCredential)

      case 'facebook':
        const facebookUser = await this.facebook(username, publicKey);

        const facebookCredential = await this.createCredential(facebookUser);

        // this.transferTipsToUser(facebookCredential);

        // const statusTransferFacebook = await this.transferTipsToUser(facebookCredential, fbUsername)

        // if (!statusTransferFacebook) throw new HttpErrors.NotFound('RPC Lost Connection')

        return this.transferTips(facebookCredential)

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

  async twitter(username: string, publicKey: string): Promise<User> {
    const {data: user} = await this.twitterService.getActions(`2/users/by/username/${username}?user.fields=profile_image_url`)

    if (!user) throw new HttpErrors.NotFound('Invalid username')

    // Fetch post timeline based on twitter userId from twitter api
    const {data: tweets} = await this.twitterService.getActions(`2/users/${user.id}/tweets?max_results=5`)

    // Verify that the publicKey is existing in user twitter
    const foundTwitterPublicKey = tweets[0].text.split(' ').find((tweet: string) => tweet === publicKey)

    if (!foundTwitterPublicKey) throw new HttpErrors.NotFound('Cannot find specified post')

    return {
      name: user.name,
      platform_account_id: user.id,
      platform: "twitter",
      username: user.username,
      profile_image_url: user.profile_image_url ? user.profile_image_url.replace('normal', '400x400') : '',
      publicKey: publicKey
    }
  }

  async reddit(username: string, publicKey: string): Promise<User> {
    // Fetch data user from reddit api
    const {data: redditUser} = await this.redditService.getActions(`user/${username}/about.json`)

    // Fetch post timeline based on reddit username from reddit api
    const {data: foundRedditPost} = await this.redditService.getActions(`user/${username}/.json?limit=1`)

    if (foundRedditPost.children.length === 0) throw new HttpErrors.NotFound('Cannot find the spesified post')

    // Verify that the publicKey is existing in user reddit
    const foundRedditPublicKey = foundRedditPost.children[0].data.title.split(' ').find((post: string) => post === publicKey)

    if (!foundRedditPublicKey) throw new HttpErrors.NotFound('Cannot find specified post')

    console.log(redditUser.subreddit.title, ">> name")

    return {
      name: redditUser.subreddit.title ? redditUser.subreddit.title : redditUser.name,
      platform_account_id: 't2_' + redditUser.id,
      platform: 'reddit',
      username: redditUser.name,
      profile_image_url: redditUser.icon_img ? redditUser.icon_img.split('?')[0] : '',
      publicKey: publicKey
    }
  }

  async facebook(username: string, publicKey: string): Promise<User> {
    const data = await this.facebookService.getActions(username, "");  
    const foundIndex = data.search(publicKey);

    if (foundIndex === -1) throw new HttpErrors.NotFound('Cannot find specified post');

    let profile_image_url = '';
    let name = '';
    let platform_account_id = '';
    let userName = '';

    // Get profile image url
    const profileImageUrlIndex = data.search('meta property="og:image" content="');
    const profileImageUrlString = data.substring(profileImageUrlIndex + 'meta property="og:image" content="'.length);

    for (let i = 0; i < profileImageUrlString.length; i++) {
      if (profileImageUrlString[i] === '"') break

      profile_image_url += profileImageUrlString[i];
    }

    // Get name
    const nameIndex = data.search('meta property="og:title" content="');
    const nameString = data.substring(nameIndex + 'meta property="og:title" content="'.length);

    for (let i = 0; i < 50; i++) {
      if (nameString[i] === '"') break

      name += nameString[i]
    }

    // Get platform account id
    const platformAccountIdIndex = data.search('content="fb://page');
    const platformAccountIdString = data.substring(platformAccountIdIndex + 'content="fb://page/'.length);

    for (let i = 0; i < 50; i++) {
      if (platformAccountIdString[i] === '?') break

      platform_account_id += platformAccountIdString[i];
    }

    // Get username
    const usernameIndex = data.search('meta http-equiv="refresh" content="0; URL=/');
    const usernameString = data.substring(usernameIndex + 'meta http-equiv="refresh" content="0; URL=/'.length);

    for (let i = 0; i < 50; i++) {
      if (usernameString[i] === '/') break

      userName += usernameString[i]
    }

    return {
      name: name,
      username: userName,
      platform_account_id: platform_account_id,
      platform: "facebook",
      profile_image_url: profile_image_url.replace(/amp;/g, ''),
      publicKey: publicKey
    }
  }

  async createCredential(user: User) {
    const {
      name, 
      platform_account_id, 
      username, 
      platform, 
      profile_image_url, 
      publicKey
    } = user

    // Verify credential
    const foundPlatformCredential = await this.userCredentialRepository.findOne({
      where: {
        userId: publicKey,
        platform: platform
      }
    })

    if (foundPlatformCredential) {
      const person = await this.peopleRepository.findOne({
        where: {
          id: foundPlatformCredential.peopleId
        }
      })

      if (person && person.platform_account_id !== platform_account_id) {
        throw new HttpErrors.NotFound(`This ${person.platform} does not belong to you!`)
      }
    }

    const foundPeople = await this.peopleRepository.findOne({
      where: {
        platform_account_id: platform_account_id,
        platform: platform
      }
    })

    if (foundPeople) {
      const foundCredential = await this.userCredentialRepository.findOne({
        where: {
          peopleId: foundPeople.id,
          platform: platform
        }
      })

      if (!foundCredential) {
        return this.peopleRepository.userCredential(foundPeople.id).create({
          userId: publicKey,
          platform: platform,
          isVerified: true
        })
      }

      if (foundCredential.userId === user.publicKey) {
        this.userCredentialRepository.updateById(foundCredential.id, {
          isVerified: true
        })

        foundCredential.isVerified = true

        return foundCredential
      }

      throw new HttpErrors.NotFound('Credential Invalid')
    }

    const newPeople = await this.peopleRepository.create({
      name, username, platform_account_id, platform, profile_image_url
    });

    if (platform === 'twitter') {
      this.fetchFollowing(platform_account_id || '');
    }

    return this.peopleRepository.userCredential(newPeople.id).create({
      userId: publicKey,
      platform: platform,
      isVerified: true
    })
  }

  async fetchFollowing(platform_account_id: string): Promise<void> {
    if (!platform_account_id) return

    const {data: following} = await this.twitterService.getActions(`2/users/${platform_account_id}/following?user.fields=profile_image_url`)

    for (let i = 0; i < following.length; i++) {
      const person = following[i]
      const foundPerson = await this.peopleRepository.findOne({
        where: {
          platform_account_id: person.id
        }
      })

      if (!foundPerson) {
        this.peopleRepository.create({
          name: person.name,
          username: person.username,
          platform_account_id: person.id,
          platform: 'twitter',
          profile_image_url: person.profile_image_url.replace('normal', '400x400'),
          hide: false,
        })
      }
    }
  }

  async transferTips(credential: UserCredential): Promise<boolean> {
    const keyring = new Keyring({
      type: process.env.MYRIAD_CRYPTO_TYPE as KeypairType,
    })

    // Adding an accoutn based on peopleId/postId
    const from = keyring.addFromUri('//' + credential.peopleId);
    const to = credential.userId // Sending address

    const foundPeople = await this.peopleRepository.findOne({
      where: {
        id: credential.peopleId
      }
    })

    if (foundPeople && foundPeople.totalTips > 0) {
      const tokenId = "AUSD";
      const rpc_address = "wss://acala-mandala.api.onfinality.io/public-ws"
      const address_format = 42
      
      // Initialize rpc web socket
      const provider = new WsProvider(rpc_address)
      const api = await new ApiPromise(
        options({
          provider
        }) as ApiOptions
      ).isReadyOrError

      // ACA to AUSD conversion
      const ausdAcaPoolString = (await api.query.dex.liquidityPool([
        { Token: 'ACA' },
        { Token: 'AUSD'}
      ])).toString();

      const ausdAcaPool = ausdAcaPoolString.substring(1, ausdAcaPoolString.length - 1)
        .replace(/"/g, '').split(',');

      const ausd = parseInt(ausdAcaPool[1]) / 10 ** 12;
      const aca = parseInt(ausdAcaPool[0]) / 10 ** 13;

      const ausdPerAca = ausd / aca;

      const encodeTo = encodeAddress(to, address_format)
      
      // Get transacation payment info
      const {weight, partialFee} = await api.tx.currencies
        .transfer(encodeTo, {TOKEN: tokenId}, Number(foundPeople.totalTips))
        .paymentInfo(from);

      const txFeeInAca = (+weight.toString() + +partialFee.toString()) / 10 ** 13

      // Get tx fee in AUSD
      const txFee = Math.floor(txFeeInAca * ausdPerAca * 10 ** 12 * 1.01);

      if (txFee > foundPeople.totalTips) {
        this.userCredentialRepository.deleteById(credential.id)

        throw new HttpErrors.UnprocessableEntity("Tx fee is not enough");
      }

      const transfer = api.tx.currencies
        .transfer(encodeTo, {TOKEN: tokenId}, Number(foundPeople.totalTips) - txFee);

      const txHash = await transfer.signAndSend(from);

      this.peopleRepository.updateById(foundPeople.id, {
        totalTips: 0
      })

      this.transactionRepository.updateAll({
        hasSendToUser: true
      }, {
        to: u8aToHex(from.publicKey),
        hasSendToUser: false
      })

      this.transactionRepository.create({
        trxHash: txHash.toString(),
        from: u8aToHex(from.publicKey),
        to: to,
        value: foundPeople.totalTips - txFee,
        state: "success",
        tokenId: tokenId,
        hasSendToUser: true
      })

      const foundDetailTransaction = await this.detailTransactionRepository.findOne({
        where: {
          userId: to
        }
      })

      if (foundDetailTransaction) {
        this.detailTransactionRepository.updateById(foundDetailTransaction.id, {
          sentToMe: foundDetailTransaction.sentToMe + (foundPeople.totalTips - txFee)
        })
      }
    }
    
    return true
  }

  // async transferTipsToUser(credential: UserCredential): Promise<boolean> {
  //   const keyring = new Keyring({
  //     type: process.env.MYRIAD_CRYPTO_TYPE as KeypairType,
  //   })

  //   // Adding an accoutn based on peopleId/postId
  //   const from = keyring.addFromUri('//' + credential.peopleId);
  //   const to = credential.userId // Sending address

  //   const totalTransaction = await this.transactionRepository.count({
  //     to: u8aToHex(from.publicKey),
  //     hasSendToUser: false,
  //     tokenId: "AUSD"
  //   })

  //   if (!totalTransaction) return true

  //   const tokenId = "AUSD";
  //   const rpc_address = "wss://acala-mandala.api.onfinality.io/public-ws"
  //   const address_format = 42
    
  //   const provider = new WsProvider(rpc_address)
  //   const api = await new ApiPromise(
  //     options({
  //       provider
  //     }) as ApiOptions
  //   ).isReadyOrError

  //   // ACA to AUSD conversion
  //   const ausdAcaPoolString = (await api.query.dex.liquidityPool([
  //     { Token: 'ACA' },
  //     { Token: 'AUSD'}
  //   ])).toString();

  //   const ausdAcaPool = ausdAcaPoolString.substring(1, ausdAcaPoolString.length - 1)
  //     .replace(/"/g, '').split(',');

  //   const ausd = parseInt(ausdAcaPool[1]) / 10 ** 12;
  //   const aca = parseInt(ausdAcaPool[0]) / 10 ** 13;

  //   const ausdPerAca = ausd / aca;

  //   for (let j = 0; j < totalTransaction.count; j++) {
  //     const transaction = (await this.transactionRepository.find({
  //       where: {
  //         to: u8aToHex(from.publicKey),
  //         hasSendToUser: false,
  //         tokenId: tokenId
  //       },
  //       limit: 1,
  //       skip: j
  //     }))[0]

  //     const encodeTo = encodeAddress(to, address_format)
      
  //     // Get transacation payment info
  //     const {weight, partialFee} = await api.tx.currencies
  //       .transfer(encodeTo, {TOKEN: tokenId}, Number(transaction.value))
  //       .paymentInfo(from);

  //     const txFeeInAca = (+weight.toString() + +partialFee.toString()) / 10 ** 13

  //     // Get tx fee in AUSD
  //     const txFee = Math.floor(txFeeInAca * ausdPerAca * 10 ** 12 * 1.01);

  //     if (txFee > Number(transaction.value)) {
  //       this.userCredentialRepository.deleteById(credential.id)
  //       throw new HttpErrors.UnprocessableEntity(`Tx fee is not enough`)
  //     }
      
  //     const transfer = api.tx.currencies
  //       .transfer(encodeTo, {TOKEN: tokenId}, Number(transaction.value) - txFee);

  //     const txHash = await transfer.signAndSend(from);

  //     this.transactionRepository.updateById(transaction.id, {
  //       hasSendToUser: true
  //     })

  //     this.transactionRepository.create({
  //       trxHash: txHash.toString(),
  //       from: transaction.from,
  //       to: to,
  //       value: +transaction.value - txFee,
  //       state: "success",
  //       tokenId: tokenId,
  //       hasSendToUser: true
  //     })

  //     const foundDetailTransaction = await this.detailTransactionRepository.findOne({
  //       where: {
  //         userId: to
  //       }
  //     })

  //     if (foundDetailTransaction) {
  //       this.detailTransactionRepository.updateById(foundDetailTransaction.id, {
  //         sentToMe: foundDetailTransaction.sentToMe + (transaction.value - txFee)
  //       })
  //     }
  //   }

  //   return true
  // }

  // async transferTipsToUser(credential: UserCredential): Promise<void> {
  //   // Create keyring instance
  //   const keyring = new Keyring({
  //     type: process.env.MYRIAD_CRYPTO_TYPE as KeypairType,
  //   });

  //   // Adding an accoutn based on peopleId/postId
  //   const from = keyring.addFromUri('//' + credential.peopleId);
  //   const to = credential.userId // Sending address
    
  //   const totalToken = await this.userTokenRepository.count({
  //     userId: to
  //   })

  //   for (let i = 0; i < totalToken.count; i++) {
  //     const token = (await this.tokenRepository.find({
  //       limit: 1,
  //       skip: i
  //     }))[0]

  //     const totalTransaction = await this.transactionRepository.count({
  //       to: u8aToHex(from.publicKey),
  //       hasSendToUser: false,
  //       tokenId: token.id
  //     })

  //     if (!totalTransaction) continue
      
  //     const tokenId = token.id
  //     const txFee = token.token_gas_fee ? token.token_gas_fee : 125000147;
  //     const rpc_address = token.rpc_address
  //     const address_format = token.address_format

  //     const api = await polkadotApi(rpc_address);      
      
  //     for (let j = 0; j < totalTransaction.count; j++) {
  //       const transaction = (await this.transactionRepository.find({
  //         where: {
  //           to: u8aToHex(from.publicKey),
  //           hasSendToUser: false,
  //           tokenId: tokenId
  //         },
  //         limit: 1,
  //         skip: j
  //       }))[0]

  //       const encodeTo = encodeAddress(to, address_format)
  //       const {data: balance} = await api.query.system.account(from.publicKey)
  //       // const data = (await api.query.tokens.accounts(
  //       //   u8aToHex(from.publicKey), 
  //       //   {Token: tokenId}
  //       // )).free.toJSON()

  //       if (balance.free.toNumber()) {
  //         const transfer = api.tx.balances.transfer(encodeTo, Number(transaction.value - txFee))
  //         const txHash = await transfer.signAndSend(from)

  //         this.transactionRepository.updateById(transaction.id, {
  //           hasSendToUser: true
  //         })

  //         this.transactionRepository.create({
  //           trxHash: txHash.toString(),
  //           from: transaction.from,
  //           to: to,
  //           value: transaction.value - txFee,
  //           state: "success",
  //           tokenId: token.id,
  //           hasSendToUser: true
  //         })

  //         const foundDetailTransaction = await this.detailTransactionRepository.findOne({
  //           where: {
  //             userId: to
  //           }
  //         })

  //         if (foundDetailTransaction) {
  //           this.detailTransactionRepository.updateById(foundDetailTransaction.id, {
  //             sentToMe: foundDetailTransaction.sentToMe + (balance.free.toNumber() - txFee)
  //           })
  //         }
  //       }
  //     }

  //     await api.disconnect()
  //   }
  // }
}

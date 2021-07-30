import {options} from "@acala-network/api";
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
import {ApiPromise, Keyring, WsProvider} from '@polkadot/api';
// import {authenticate} from '@loopback/authentication';
import {ApiOptions} from '@polkadot/api/types';
import {encodeAddress} from '@polkadot/keyring';
import {u8aToHex} from '@polkadot/util';
import {KeypairType} from '@polkadot/util-crypto/types';
import dotenv from 'dotenv';
import {PlatformType} from '../enums';
import puppeteer from "../helpers/puppeteer";
import {User, VerifyUser} from '../interfaces';
import {UserCredential} from '../models';
import {
  DetailTransactionRepository, PeopleRepository, TipRepository, TokenRepository, TransactionRepository, UserCredentialRepository,
  UserTokenRepository
} from '../repositories';
import {Facebook, Reddit, Twitter} from '../services';

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
    @repository(TipRepository) public tipRepository: TipRepository,
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
      // TODO: move to single constant enum platform
      case PlatformType.TWITTER:
        // Fetch data user from twitter api
        const twitterUser = await this.twitter(username, publicKey);

        // Add new credential
        const twitterCredential = await this.createCredential(twitterUser);

        this.transferTips(twitterCredential);

        return true

      // TODO: move to single constant enum platform
      case PlatformType.REDDIT:
        const redditUser = await this.reddit(username, publicKey);
        const redditCredential = await this.createCredential(redditUser)

        this.transferTips(redditCredential)

        return true

      // TODO: move to single constant enum platform
      case PlatformType.FACEBOOK:
        const facebookUser = await this.facebook(username, publicKey);

        const facebookCredential = await this.createCredential(facebookUser);

        this.transferTips(facebookCredential);

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
      platform: PlatformType.TWITTER, // TODO: move to single constant enum platform,
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

    return {
      name: redditUser.subreddit.title ? redditUser.subreddit.title : redditUser.name,
      platform_account_id: 't2_' + redditUser.id,
      platform: PlatformType.REDDIT, // TODO: move to single constant enum platform,
      username: redditUser.name,
      profile_image_url: redditUser.icon_img ? redditUser.icon_img.split('?')[0] : '',
      publicKey: publicKey
    }
  }

  async facebook(username: string, publicKey: string): Promise<User> {
    const usernameSplit = username.split('/');
    const fbUser = usernameSplit[3];
    const postId = usernameSplit[5];

    const browser = await puppeteer();

    const page = await browser.newPage();
    await page.goto(
      `https://mbasic.facebook.com/${fbUser}/posts/${postId}`,
      { waitUntil: 'networkidle0' }
    );
    const pageData = await page.evaluate(
      () =>  document.querySelector('*')?.outerHTML
    );

    if (pageData == null) throw new HttpErrors.NotFound('Cannot find specified post');

    const data = pageData.toString();
    const foundIndex = data.search(publicKey);
    const getPublicKey = data.substring(foundIndex, foundIndex + 66);

    if (foundIndex === -1) throw new HttpErrors.NotFound('Cannot find specified post');
    if (getPublicKey.replace('"', '').trim() !== publicKey) throw new HttpErrors.NotFound('Cannot find specified post')

    let platform_account_id: string = '';
    let profile_image_url: string = '';

    const findSocialMedialPostingIndex = data.search('"SocialMediaPosting"');
    const post = data.substring(findSocialMedialPostingIndex);

    // Get platform account id
    const findEntityIdIndex = post.search('"entity_id"');
    const entityIndex = post.substring(findEntityIdIndex + '"entity_id"'.length + 2);

    for (let i = 0; i < entityIndex.length; i++) {
      if (entityIndex[i] == '"') break
      else {
        platform_account_id += entityIndex[i]
      }
    }

    // Get profile image url
    const findIndex = post.search(`"identifier":${platform_account_id}`);
    const getString = post.substring(findIndex);
    const findImageIndex = getString.search('"image"');
    const getImageString = getString.substring(findImageIndex + '"image"'.length + 2);

    for (let i = 0; i < getImageString.length; i++) {
      if (getImageString[i] == '"') break

      profile_image_url += getImageString[i];
    }

    // Get name
    let arrayName = [];

    for (let i = findIndex - 1; i > 0; i--) {
      if (post[i] === ":") break;
      if (post[i] == '"' || post[i] == ",") continue

      arrayName.unshift(post[i])
    }

    // Get username
    const getUrl = post.substring(findIndex + `"identifier":${platform_account_id},"url":"`.length);

    let url = '';

    for (let i = 0; getUrl.length; i++) {
      if (getUrl[i] === '"') break
      url += getUrl[i]
    }

    const userName = url.replace(/\\/g, '').split('/')[3];

    if (!userName && !arrayName.join('')) {
      throw new HttpErrors.NotFound('Cannot find specified post')
    }

    return {
      name: arrayName.join(''),
      username: userName,
      platform_account_id: platform_account_id,
      profile_image_url: profile_image_url.split('\\').join(''),
      platform: PlatformType.FACEBOOK, // TODO: move to single constant enum platform
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
          platform: PlatformType.TWITTER,
          profile_image_url: person.profile_image_url.replace('normal', '400x400'),
          hide: false,
        })
      }
    }
  }

  //TODO: use dynamic currency from db
  async transferTips(credential: UserCredential): Promise<void> {
    const keyring = new Keyring({
      type: process.env.MYRIAD_CRYPTO_TYPE as KeypairType,
    })

    // Adding an accoutn based on peopleId/postId
    const from = keyring.addFromUri('//' + credential.peopleId);
    const to = credential.userId // Sending address

    const foundPeople = await this.peopleRepository.findOne({
      where: {
        id: credential.peopleId
      },
      include: [
        {
          relation: 'tips',
          scope: {
            where: {
              totalTips: {
                gt: 0
              }
            }
          }
        }
      ]
    })

    if (foundPeople && foundPeople.tips && foundPeople.tips.length > 0) {
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
        {Token: 'ACA'},
        {Token: 'AUSD'}
      ])).toString();

      const ausdAcaPool = ausdAcaPoolString.substring(1, ausdAcaPoolString.length - 1)
        .replace(/"/g, '').split(',');

      const ausd = parseInt(ausdAcaPool[1]) / 10 ** 12;
      const aca = parseInt(ausdAcaPool[0]) / 10 ** 13;

      const ausdPerAca = ausd / aca;

      const encodeTo = encodeAddress(to, address_format);

      for (let i = 0; i < foundPeople.tips.length; i++) {
        const {id, tokenId, totalTips} = foundPeople.tips[i];

        // Get transacation payment info
        const {weight, partialFee} = await api.tx.currencies
          .transfer(encodeTo, {Token: tokenId}, Number(totalTips))
          .paymentInfo(from);

        const txFeeInAca = (+weight.toString() + +partialFee.toString()) / 10 ** 13

        // Get tx fee in AUSD
        const txFee = Math.floor(txFeeInAca * ausdPerAca * 10 ** 12);

        const transfer = api.tx.currencies
          .transfer(encodeTo, {Token: tokenId}, Number(totalTips) - txFee);

        await transfer.signAndSend(from);

        this.tipRepository.updateById(id, {totalTips: Number(totalTips - txFee)});

        this.transactionRepository.updateAll({
          hasSendToUser: true
        }, {
          to: u8aToHex(from.publicKey),
          hasSendToUser: false
        })

        const foundDetailTransaction = await this.detailTransactionRepository.findOne({
          where: {
            userId: to
          }
        })

        if (foundDetailTransaction) {
          this.detailTransactionRepository.updateById(foundDetailTransaction.id, {
            sentToMe: foundDetailTransaction.sentToMe + (+totalTips - txFee)
          })
        } else {
          this.detailTransactionRepository.create({
            sentToMe: totalTips - txFee,
            sentToThem: 0,
            userId: credential.userId,
            tokenId: tokenId
          })
        }
      }
    }
  }
}

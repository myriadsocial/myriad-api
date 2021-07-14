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
import {Token, Transaction, User} from '../models';
import {
  DetailTransactionRepository,
  TokenRepository,
  TransactionRepository,
  UserRepository,
  QueueRepository,
  PostRepository,
  PeopleRepository,
  TipRepository,
} from '../repositories';
import {polkadotApi} from '../helpers/polkadotApi';
import {KeypairType} from '@polkadot/util-crypto/types';
import {u8aToHex} from '@polkadot/util';
import {authenticate} from '@loopback/authentication';

import dotenv from 'dotenv';
import Keyring, { encodeAddress } from '@polkadot/keyring';

dotenv.config();

// @authenticate("jwt")
export class TransactionController {
  constructor(
    @repository(TransactionRepository)
    public transactionRepository: TransactionRepository,
    @repository(UserRepository)
    public userRepository: UserRepository,
    @repository(DetailTransactionRepository)
    public detailTransactionRepository: DetailTransactionRepository,
    @repository(TokenRepository)
    public tokenRepository: TokenRepository,
    @repository(QueueRepository)
    public queueRepository: QueueRepository,
    @repository(PostRepository) 
    public postRepository: PostRepository,
    @repository(TipRepository)
    public tipRepository: TipRepository
  ) { }

  @post('/transactions')
  @response(200, {
    description: 'Transaction model instance',
    content: {'application/json': {schema: getModelSchemaRef(Transaction)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Transaction, {
            title: 'NewTransaction',
            exclude: ['id'],
          }),
        },
      },
    })
    transaction: Omit<Transaction, 'id'>,
  ): Promise<Transaction> {
    const foundToken = await this.tokenRepository.findOne({
      where: {
        id: transaction.tokenId.toUpperCase()
      }
    })

    if (!foundToken) {
      throw new HttpErrors.NotFound('Token not found')
    }

    // Check if user exist
    await this.userRepository.findById(transaction.from);

    // Reward to FROM for doing transactions
    this.sentMyriadReward(transaction.from); 

    const from = transaction.from;
    const to = transaction.to;
    const value = transaction.value;
    const tokenId = transaction.tokenId.toUpperCase();

    // Detail transaction of FROM
    const foundFromUser = await this.findDetailTransaction(from, tokenId)

    if (foundFromUser) {
      this.detailTransactionRepository.updateById(foundFromUser.id, {
        sentToThem: foundFromUser.sentToThem + value
      })
    } else {
      this.detailTransactionRepository.create({
        sentToMe: 0,
        sentToThem: value,
        userId: from,
        tokenId: tokenId.toUpperCase()
      })
    }

    // Detail Transaction of TO
    const foundToUser = await this.findDetailTransaction(to, tokenId)

    if (foundToUser) {
      this.detailTransactionRepository.updateById(foundToUser.id, {
        sentToMe: foundToUser.sentToMe + value
      })
    } else {
      // TO maybe doesn't exist yet in myriad
      const foundUser = await this.userRepository.findOne({
        where: {
          id: to
        }
      })

      // Find post to get peopleId
      const foundPost = await this.postRepository.findOne({
        where: {
          walletAddress: to
        }
      })

      const foundTip = await this.tipRepository.findOne({
        where: {
          peopleId: foundPost?.peopleId,
          tokenId: tokenId
        }
      })

      if (foundTip) {
        this.tipRepository.updateById(foundTip.id, {
          totalTips: foundTip.totalTips + Number(value) 
        })
      } else {
        this.tipRepository.create({
          totalTips: Number(value),
          tokenId: tokenId,
          peopleId: foundPost?.peopleId
        })
      }

      // If the public key is not belong to user
      if (!foundUser) {
        return this.transactionRepository.create({
          ...transaction,
          value: value,
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
          hasSendToUser: false
        })
      }

      // If detail transaction belong to user
      this.detailTransactionRepository.create({
        sentToMe: value,
        sentToThem: 0,
        tokenId: tokenId,
        userId: to
      })
    }

    return this.transactionRepository.create({
      ...transaction,
      value: value,
      createdAt: new Date().toString(),
      updatedAt: new Date().toString(),
      hasSendToUser: true
    });
  }

  @get('/transactions/{id}/token', {
    responses: {
      '200': {
        description: 'Token belonging to Transaction',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Token)},
          },
        },
      },
    },
  })
  async getToken(
    @param.path.string('id') id: typeof Transaction.prototype.id,
  ): Promise<Token> {
    return this.transactionRepository.token(id);
  }

  @get('/transactions/{id}/user', {
    responses: {
      '200': {
        description: 'User belonging to Transaction',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(User)},
          },
        },
      },
    },
  })
  async getUser(
    @param.path.string('id') id: typeof Transaction.prototype.id,
  ): Promise<User> {
    return this.transactionRepository.toUser(id);
  }

  @get('/transactions')
  @response(200, {
    description: 'Array of Transaction model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Transaction, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Transaction) filter?: Filter<Transaction>,
  ): Promise<Transaction[]> {
    return this.transactionRepository.find(filter);
  }

  @get('/transactions/{id}')
  @response(200, {
    description: 'Transaction model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Transaction, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Transaction, {exclude: 'where'}) filter?: FilterExcludingWhere<Transaction>
  ): Promise<Transaction> {
    return this.transactionRepository.findById(id, filter);
  }

  @patch('/transactions/{id}')
  @response(204, {
    description: 'Transaction PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Transaction, {partial: true}),
        },
      },
    })
    transaction: Transaction,
  ): Promise<void> {
    await this.transactionRepository.updateById(id, {
      ...transaction,
      updatedAt: new Date().toString()
    });
  }

  @del('/transactions/{id}')
  @response(204, {
    description: 'Transaction DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.transactionRepository.deleteById(id);
  }

  async findDetailTransaction(userId: string, tokenId: string) {
    return this.detailTransactionRepository.findOne({
      where: {
        userId: userId,
        tokenId: tokenId
      }
    })
  }

  async sentMyriadReward(userId: string):Promise<void> {
    const provider = process.env.MYRIAD_WS_RPC || "";
    const myriadPrefix = Number(process.env.MYRIAD_ADDRESS_PREFIX);
    const api = await polkadotApi(provider);
    const keyring = new Keyring({
      type: process.env.MYRIAD_CRYPTO_TYPE as KeypairType,
      ss58Format: myriadPrefix
    })

    const mnemonic = process.env.MYRIAD_FAUCET_MNEMONIC ?? "";
    const from  = keyring.addFromMnemonic(mnemonic);
    const to = encodeAddress(userId, myriadPrefix);
    const reward = +(1 * 10 ** 12);
    const {nonce} = await api.query.system.account(from.address);

    const foundQueue = await this.queueRepository.findOne({
      where: {
        id: "admin"
      }
    })

    let foundAdmin = await this.userRepository.findOne({
      where: {
        id: u8aToHex(from.publicKey)
      }
    });

    if (!foundAdmin) {
      foundAdmin = await this.userRepository.create({
        id: u8aToHex(from.publicKey),
        name: 'Myriad',
        username: 'myriad',
        skip_tour: true,
        is_online: false
      })
    }

    // Set queueu if there is multiple transactions
    let count: number = nonce.toJSON();
    
    if (!foundQueue) {
      await this.queueRepository.create({
        id: "admin",
        count: count + 1
      })
    } else {
      if (foundQueue.count >= nonce.toJSON()) {
        count = foundQueue.count
      } else {
        count = nonce.toJSON()
      }

      await this.queueRepository.updateById(foundQueue.id, {count: count + 1})
    }

    // Transaction reward
    const transfer = api.tx.balances.transfer(to, reward);
    const txhash = await transfer.signAndSend(from, {nonce: count});

    this.transactionRepository.create({
      trxHash: txhash.toString(),
      from: u8aToHex(from.publicKey),
      to: userId,
      value: reward,
      hasSendToUser: true,
      state: 'success',
      createdAt: new Date().toString(),
      tokenId: 'MYR'
    })

    const foundUserDetailTransaction = await this.findDetailTransaction(userId, "MYR");

    if (foundUserDetailTransaction) {
      this.detailTransactionRepository.updateById(foundUserDetailTransaction.id, {
        sentToMe: foundUserDetailTransaction.sentToMe + reward
      })
    } else {
      this.detailTransactionRepository.create({
        sentToMe: reward,
        sentToThem: 0,
        userId: userId,
        tokenId: "MYR"
      })
    }

    await api.disconnect()
  }
}

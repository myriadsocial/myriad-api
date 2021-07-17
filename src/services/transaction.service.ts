import {Count, repository} from '@loopback/repository';
import {PaymentInfo} from '../interfaces';
import {PostTip, Transaction, TransactionHistory} from '../models';
import {
  PostTipRepository,
  PersonTipRepository,
  TransactionHistoryRepository,
  TransactionRepository,
  UserRepository,
  PostRepository,
} from '../repositories';

export class TransactionService {
  constructor(
    @repository(TransactionHistoryRepository)
    protected transactionHistoryRepository: TransactionHistoryRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(TransactionRepository)
    protected transactionRepository: TransactionRepository,
    @repository(PersonTipRepository)
    protected personTipRepository: PersonTipRepository,
    @repository(PostTipRepository)
    protected postTipRepository: PostTipRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
  ) {}

  async recordTransaction(paymentInfo: PaymentInfo): Promise<void> {
    const {tipId, fromString, txHash, to, total, txFee, cryptoId} = paymentInfo;

    if (tipId) {
      this.personTipRepository.updateById(tipId, {total: 0}) as Promise<void>;
      this.transactionRepository.updateAll(
        {
          hasSentToUser: true,
        },
        {
          to: fromString,
          hasSentToUser: false,
        },
      ) as Promise<Count>;
    }

    this.transactionRepository.create({
      trxHash: txHash.toString(),
      from: fromString,
      to: to,
      value: total - txFee,
      state: 'success',
      cryptocurrencyId: cryptoId,
      createdAt: new Date().toString(),
      updatedAt: new Date().toString(),
      hasSentToUser: true,
    }) as Promise<Transaction>;

    const newTransactionHistory = {
      sentToMe: +(total - txFee),
      sentToThem: 0,
      userId: to,
      cryptocurrencyId: cryptoId,
    };

    this.recordTransactionHistory(
      newTransactionHistory as Omit<TransactionHistory, 'id'>,
    ) as Promise<void>;
  }

  async recordTransactionHistory(
    transactionHistory: TransactionHistory,
  ): Promise<void> {
    const {
      sentToMe,
      sentToThem,
      userId,
      cryptocurrencyId: cryptoId,
    } = transactionHistory;

    const foundTransactionHistory =
      await this.transactionHistoryRepository.findOne({
        where: {
          userId: userId,
          cryptocurrencyId: cryptoId,
        },
      });

    if (sentToMe) {
      if (foundTransactionHistory) {
        foundTransactionHistory.sentToMe =
          foundTransactionHistory.sentToMe + sentToMe;
        foundTransactionHistory.updatedAt = new Date().toString();

        this.transactionHistoryRepository.updateById(
          foundTransactionHistory.id,
          foundTransactionHistory,
        ) as Promise<void>;
      } else {
        transactionHistory.createdAt = new Date().toString();
        transactionHistory.updatedAt = new Date().toString();

        this.transactionHistoryRepository.create(
          transactionHistory,
        ) as Promise<TransactionHistory>;
      }
    } else {
      if (foundTransactionHistory) {
        foundTransactionHistory.updatedAt = new Date().toString();
        foundTransactionHistory.sentToThem =
          foundTransactionHistory.sentToThem + sentToThem;

        this.transactionHistoryRepository.updateById(
          foundTransactionHistory.id,
          foundTransactionHistory,
        ) as Promise<void>;
      } else {
        transactionHistory.createdAt = new Date().toString();
        transactionHistory.updatedAt = new Date().toString();

        this.transactionHistoryRepository.create(
          transactionHistory,
        ) as Promise<TransactionHistory>;
      }
    }
  }

  async isTotalTipInPersonUpdated(
    userId: string,
    postId: string | undefined,
    cryptoId: string,
    value: number,
  ): Promise<boolean> {
    if (!postId) return false;

    const foundPost = await this.postRepository.findById(postId);
    const foundUser = await this.userRepository.findOne({where: {id: userId}});

    if (!foundUser) {
      const foundPersonTip = await this.personTipRepository.findOne({
        where: {
          peopleId: foundPost.peopleId,
          cryptocurrencyId: cryptoId,
        },
      });

      if (foundPersonTip) {
        this.personTipRepository.updateById(foundPersonTip.id, {
          total: foundPersonTip.total + value,
        }) as Promise<void>;
      } else {
        this.personTipRepository.create({
          total: value,
          cryptocurrencyId: cryptoId,
          peopleId: foundPost.peopleId,
        }) as Promise<PostTip>;
      }

      this.totalTipInPost(postId, cryptoId, value) as Promise<void>;

      return true;
    }

    this.totalTipInPost(postId, cryptoId, value) as Promise<void>;

    return false;
  }

  async totalTipInPost(
    postId: string,
    cryptoId: string,
    value: number,
  ): Promise<void> {
    const foundPostTips = await this.postTipRepository.findOne({
      where: {
        postId,
        cryptocurrencyId: cryptoId,
      },
    });

    if (foundPostTips) {
      this.postTipRepository.updateById(foundPostTips.id, {
        total: foundPostTips.total + value,
      }) as Promise<void>;
    } else {
      this.postTipRepository.create({
        postId,
        cryptocurrencyId: cryptoId,
        total: value,
      }) as Promise<PostTip>;
    }
  }
}

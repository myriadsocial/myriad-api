import {AuthenticationBindings} from '@loopback/authentication';
import {BindingScope, inject, injectable, service} from '@loopback/core';
import {
  AnyObject,
  Count,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {isHex} from '@polkadot/util';
import NonceGenerator from 'a-nonce-generator';
import {assign, omit} from 'lodash';
import {config} from '../config';
import {
  ActivityLogType,
  FriendStatusType,
  PermissionKeys,
  PlatformType,
  ReferenceType,
} from '../enums';
import {TokenServiceBindings} from '../keys';
import {
  AccountSetting,
  ActivityLog,
  Comment,
  CreateImportedPostDto,
  CreateReportDto,
  CreateUserPersonalAccessTokenDto,
  Credential,
  DraftPost,
  Experience,
  Friend,
  LanguageSetting,
  Notification,
  NotificationSetting,
  Post,
  Priority,
  Report,
  RequestOTPByEmail,
  SocialMediaVerificationDto,
  Transaction,
  TxDetail,
  UpdateTransactionDto,
  UpdateUserDto,
  UpdateUserPersonalAccessTokenDto,
  User,
  UserCurrency,
  UserByEmail,
  UserExperience,
  UserPersonalAccessToken,
  UserSocialMedia,
  Vote,
  Wallet,
} from '../models';
import {
  ChangeEmailRequestRepository,
  UserPersonalAccessTokenRepository,
  UserRepository,
  WalletRepository,
} from '../repositories';
import {PolkadotJs} from '../utils/polkadot-js';
import {validateAccount} from '../utils/validate-account';
import {JWTService} from './authentication';
import {CommentService} from './comment.service';
import {CurrencyService} from './currency.service';
import {FriendService} from './friend.service';
import {NetworkService} from './network.service';
import {NotificationService} from './notification.service';
import {PostService} from './post.service';
import {ReportService} from './report.service';
import {TransactionService} from './transaction.service';
import {UserExperienceService} from './user-experience.service';
import {UserOTPService} from './user-otp.service';
import {UserSocialMediaService} from './user-social-media.service';
import {VoteService} from './vote.service';
import validator from 'validator';

export interface AfterFindProps {
  friendsName?: string;
  name?: string;
  mutual?: string;
  additional?: AnyObject;
}

@injectable({scope: BindingScope.TRANSIENT})
export class UserService {
  constructor(
    @repository(ChangeEmailRequestRepository)
    private changeEmailRequestRepository: ChangeEmailRequestRepository,
    @repository(UserRepository)
    private userRepository: UserRepository,
    @repository(UserPersonalAccessTokenRepository)
    private userPersonalAccessTokenRepository: UserPersonalAccessTokenRepository,
    @repository(WalletRepository)
    private walletRepository: WalletRepository,
    @service(CommentService)
    private commentService: CommentService,
    @service(CurrencyService)
    private currencyService: CurrencyService,
    @service(UserExperienceService)
    private userExperienceService: UserExperienceService,
    @service(FriendService)
    private friendService: FriendService,
    @service(NetworkService)
    private networkService: NetworkService,
    @service(NotificationService)
    private notificationService: NotificationService,
    @service(PostService)
    private postService: PostService,
    @service(ReportService)
    private reportService: ReportService,
    @service(TransactionService)
    private transactionService: TransactionService,
    @service(UserOTPService)
    private userOTPService: UserOTPService,
    @service(UserSocialMediaService)
    private userSocialMediaService: UserSocialMediaService,
    @service(VoteService)
    private voteService: VoteService,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    private jwtService: JWTService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private currentUser: UserProfile,
  ) {}

  // ------------------------------------------------

  // ------ User ------------------------------------

  public async findById(id: string, filter?: Filter<User>) {
    return this.userRepository.findById(id, filter);
  }

  public async find(filter?: Filter<User>): Promise<User[]> {
    return this.userRepository.find(filter);
  }

  public async updateById(id: string, user: Partial<User>): Promise<void> {
    return this.userRepository.updateById(id, user);
  }

  public async current(filter?: Filter<User>): Promise<User> {
    const wallet = await this.walletRepository.findOne({
      where: {
        userId: this.currentUser?.[securityId] ?? '',
        primary: true,
      },
    });

    const include = filter?.include ?? [];

    if (wallet) {
      const networkId = wallet.networkId;

      include.push({
        relation: 'userCurrencies',
        scope: {
          include: [{relation: 'currency'}],
          where: {networkId},
          order: ['priority ASC'],
          limit: 10,
        },
      });
    }

    return this.findById(this.currentUser[securityId], {include});
  }

  public async updateProfile(user: Partial<UpdateUserDto>): Promise<void> {
    return this.updateById(this.currentUser[securityId], user)
      .then(() => this.afterUpdateProfile(user))
      .catch(err => {
        throw err;
      });
  }

  public async activityLog(
    filter?: Filter<ActivityLog>,
  ): Promise<ActivityLog[]> {
    return this.userRepository
      .activityLogs(this.currentUser[securityId])
      .find(filter);
  }

  public async afterFind(
    result: User[],
    props: AfterFindProps,
  ): Promise<AnyObject[]> {
    const currentUser = this.currentUser?.[securityId] ?? '';

    if (props?.friendsName && props?.additional) {
      const {userIds, requestor} = props.additional;
      return Promise.all(
        result.map(async user => {
          const friend: AnyObject = {
            id: userIds[user.id],
            requestorId: requestor.id,
            requesteeId: user.id,
            status: FriendStatusType.APPROVED,
            requestee: {
              id: user.id,
              name: user.name,
              username: user.username,
              profilePictureURL: user.profilePictureURL,
            },
            requestor: {
              id: requestor.id,
              name: requestor.name,
              username: requestor.username,
              profilePictureURL: requestor.profilePictureURL,
            },
          };

          if (props?.mutual === 'true') {
            const {count} = await this.friendService.countMutual(
              requestor.id,
              user.id,
            );

            friend.totalMutual = count;
          }

          if (currentUser === friend.requestorId) return friend;

          const friendInfo = await this.friendService.getFriendInfo(
            currentUser,
            user.id,
          );

          if (!friendInfo) return friend;

          return {
            ...friend,
            requestee: {
              ...friend.requestee,
              friendInfo,
            },
          };
        }),
      );
    }

    if (props?.name) {
      return Promise.all(
        result.map(async (user: User) => {
          if (currentUser === user.id) {
            return omit(
              {
                ...user,
                friendInfo: {
                  status: 'owner',
                },
              },
              ['nonce', 'permissions', 'friendIndex'],
            );
          }

          const friendInfo = await this.friendService.getFriendInfo(
            currentUser,
            user.id,
          );

          if (!friendInfo) return user;

          return omit(
            {
              ...user,
              friendInfo,
            },
            ['nonce', 'permissions', 'friendIndex'],
          );
        }),
      );
    }

    return result;
  }

  // ------------------------------------------------

  // ------ PersonalAccessToken ---------------------

  public async accessTokens(): Promise<UserPersonalAccessToken[]> {
    return this.userPersonalAccessTokenRepository.find({
      where: {
        userId: this.currentUser[securityId],
      },
      order: ['createdAt DESC'],
    });
  }

  public async createAccessToken(
    data: CreateUserPersonalAccessTokenDto,
  ): Promise<UserPersonalAccessToken> {
    const accessToken = await this.jwtService.generateToken(this.currentUser);
    const pat = new UserPersonalAccessToken({
      ...data,
      token: accessToken,
      userId: this.currentUser[securityId],
    });

    return this.userPersonalAccessTokenRepository.create(pat);
  }

  public async updateAccessTokenScopes(
    id: string,
    data: Partial<UpdateUserPersonalAccessTokenDto>,
  ): Promise<Count> {
    if (!data?.scopes) return {count: 0};
    return this.userPersonalAccessTokenRepository.updateAll(data, {
      id,
      userId: this.currentUser[securityId],
    });
  }

  public async removeAccessToken(id: string): Promise<Count> {
    return this.userPersonalAccessTokenRepository.deleteAll({
      id,
      userId: this.currentUser[securityId],
    });
  }

  // ------------------------------------------------

  // ------ UserSocialMedia -------------------------

  public async socialMedia(
    filter?: Filter<UserSocialMedia>,
  ): Promise<UserSocialMedia[]> {
    return this.userSocialMediaService.find(filter);
  }

  public async verifySocialMedia(
    data: SocialMediaVerificationDto,
  ): Promise<UserSocialMedia> {
    return this.userSocialMediaService.create(data);
  }

  public async setPrimarySocialMedia(id: string): Promise<void> {
    return this.userSocialMediaService.patch(id);
  }

  public async removeSocialMedia(id: string): Promise<void> {
    return this.userSocialMediaService.deleteById(id);
  }

  // ------------------------------------------------

  // ------ Vote ------------------------------------

  public async createVote(vote: Vote): Promise<Vote> {
    vote.userId = this.currentUser[securityId];
    return this.voteService.create(vote);
  }

  public async removeVote(id: string): Promise<Count> {
    return this.voteService.remove(id, this.currentUser[securityId]);
  }

  // ------------------------------------------------

  // ------ Wallet ----------------------------------

  public async currentWallet(): Promise<Wallet> {
    const wallet = await this.walletRepository.findOne({
      where: {
        primary: true,
        userId: this.currentUser[securityId],
      },
      include: ['user', 'network'],
    });

    if (!wallet) {
      throw new HttpErrors.NotFound('WalletNotFound');
    }

    return wallet;
  }

  public async wallets(id: string, filter?: Filter<Wallet>): Promise<Wallet[]> {
    return this.userRepository.wallets(id).find(filter);
  }

  public async removeWallet(id: string, credential: Credential): Promise<void> {
    const {networkType} = credential;
    const {userId, primary} = await this.walletRepository.findById(id);
    const {count} = await this.walletRepository.count({userId});

    let errMessage = null;

    if (userId !== this.currentUser?.[securityId]) errMessage = 'WalletNotFoud';
    if (count === 1) errMessage = 'DeletionFailedOnlyWallet';
    if (primary) errMessage = 'DeletionFailedPrimaryWallet';
    if (errMessage) throw new HttpErrors.UnprocessableEntity(errMessage);

    const network = await this.networkService.findById(networkType);
    const verified = await validateAccount(credential, network, id);

    if (!verified) {
      throw new HttpErrors.UnprocessableEntity('FailedToVerify');
    }

    return this.walletRepository.deleteById(id).then(() => {
      const ng = new NonceGenerator();
      const nonce = ng.generate();

      this.userRepository.updateById(userId, {nonce}) as Promise<void>;
    });
  }

  public async connectWallet(credential: Credential): Promise<Wallet> {
    const userId = this.currentUser[securityId];
    const {networkType: networkId} = credential;

    if (!credential?.data?.id) {
      throw new HttpErrors.UnprocessableEntity('WalletIdNotFound');
    }

    const network = await this.networkService.findById(networkId);
    const wallet = await this.walletRepository.findOne({
      where: {id: credential.data.id},
    });

    if (wallet && wallet.userId !== this.currentUser?.[securityId]) {
      throw new HttpErrors.UnprocessableEntity('WalletAlreadyExist');
    }

    const verified = await validateAccount(
      credential,
      network,
      credential.data.id,
    );

    if (!verified) {
      throw new HttpErrors.UnprocessableEntity('FailedToVerify');
    }

    if (wallet) return wallet;

    const raw = new Wallet({
      ...credential.data,
      userId,
      networkId,
      primary: false,
    });

    return this.userRepository
      .wallets(userId)
      .create(raw)
      .then(result => this.afterConnectWallet(result))
      .catch(err => {
        throw err;
      });
  }

  // ------------------------------------------------

  // ------ Switch ----------------------------------

  public async switchNetwork(credential: Credential): Promise<Wallet> {
    const userId = this.currentUser[securityId];
    const {networkType: networkId} = credential;
    const [publicAddress, near] = credential.publicAddress.split('/');
    const nearAccount = isHex(`0x${near}`) ? `0x${near}` : near;
    const [network, wallet] = await Promise.all([
      this.networkService.findById(networkId),
      this.walletRepository.findOne({
        where: {
          id: nearAccount ?? publicAddress,
          userId: userId,
        },
      }),
    ]);

    if (!wallet) {
      throw new HttpErrors.UnprocessableEntity('Wallet not connected');
    }

    if (wallet.id !== (nearAccount ?? publicAddress)) {
      throw new HttpErrors.UnprocessableEntity('Wrong address');
    }

    if (wallet.networkId === networkId && wallet.primary === true) {
      throw new HttpErrors.UnprocessableEntity('Network already connected');
    }

    const verified = await validateAccount(
      assign(credential, {publicAddress}),
      network,
      wallet.id,
    );

    if (!verified) {
      throw new HttpErrors.UnprocessableEntity('[update] Failed to verify');
    }

    wallet.networkId = networkId;
    wallet.primary = true;
    wallet.updatedAt = new Date().toString();

    await this.userRepository
      .wallets(this.currentUser[securityId])
      .patch(omit(wallet, ['id']), {id: wallet.id});

    return this.afterSwitchNetwork(wallet);
  }

  // ------------------------------------------------

  // ------ Claim -----------------------------------

  public async claimReference(
    txDetail: TxDetail,
  ): Promise<Pick<Transaction, 'hash'>> {
    return this.networkService.claim(txDetail);
  }

  // ------------------------------------------------

  // ------ Report ----------------------------------

  public async createReport(data: CreateReportDto): Promise<Report> {
    return this.reportService.create(this.currentUser[securityId], data);
  }

  // ------------------------------------------------

  // ------ Setting ---------------------------------

  public async notificationSetting(): Promise<NotificationSetting> {
    return this.userRepository
      .notificationSetting(this.currentUser[securityId])
      .get();
  }

  public async setNotificationSetting(
    notificationSetting: Partial<NotificationSetting>,
  ): Promise<Count> {
    return this.userRepository
      .notificationSetting(this.currentUser[securityId])
      .patch(notificationSetting);
  }

  public async languageSetting(): Promise<LanguageSetting> {
    return this.userRepository
      .languageSetting(this.currentUser[securityId])
      .get();
  }

  public async setLanguageSetting(
    languageSetting: Partial<LanguageSetting>,
  ): Promise<Count> {
    return this.userRepository
      .languageSetting(this.currentUser[securityId])
      .patch(languageSetting);
  }

  public async accountSetting(): Promise<AccountSetting> {
    return this.userRepository
      .accountSetting(this.currentUser[securityId])
      .get();
  }

  public async setAccountSetting(
    accountSetting: Partial<AccountSetting>,
  ): Promise<Count> {
    return this.userRepository
      .accountSetting(this.currentUser[securityId])
      .patch(accountSetting);
  }

  public async setEmailSetting(userByEmail: Partial<UserByEmail>): Promise<void> {
    const currentEmail = this.currentUser?.email;

    let action = true; // Action Add/Remove email, true = add email, false = remove email
    if (userByEmail.email) {
      // Add email
      if (currentEmail) {
        throw new HttpErrors.UnprocessableEntity('Email already exists');
      }
    } else {
      // Remove email
      const wallets = await this.walletRepository.find({
        where: {userId: this.currentUser?.[securityId] ?? ''},
      });

      if (wallets.length === 0) {
        throw new HttpErrors.UnprocessableEntity('CannotRemoveEmail');
      }

      if (currentEmail) userByEmail.email = currentEmail;
      action = false;
    }

    const {token, email} = userByEmail;

    if (!token) {
      throw new HttpErrors.UnprocessableEntity('OTP invalid or expired');
    }

    if ((email && !validator.isEmail(email)) || !email) {
      throw new HttpErrors.UnprocessableEntity('Invalid Email Address');
    }

    const validOTP = await this.userOTPService.verifyOTP(token);

    if (!validOTP) {
      throw new HttpErrors.UnprocessableEntity('OTP invalid or expired');
    }

    if (validOTP.userId.toString() !== this.currentUser[securityId]) {
      throw new HttpErrors.Unauthorized('Invalid user');
    }

    const key = `email-request/${this.currentUser[securityId]}`;
    const [users, changeEmailRequest] = await Promise.all([
      this.userRepository.find({
        where: {
          or: [{id: validOTP.userId}, {email}],
        },
      }),
      this.changeEmailRequestRepository.get(key),
    ]);

    if (!users.length) {
      throw new HttpErrors.UnprocessableEntity('User not exists');
    }

    if (users.length > 1) {
      throw new HttpErrors.UnprocessableEntity('Email already Exists');
    }

    if (changeEmailRequest?.email !== email) {
      throw new HttpErrors.UnprocessableEntity('Invalid email address');
    }

    await Promise.all([
      this.userOTPService.removeOTP(token),
      this.changeEmailRequestRepository.delete(key),
      this.userRepository.updateById(validOTP.userId, {
        email: action ? email : undefined,
      }),
    ]);
  }

  public async requestOTPByEmail(
    requestOTP: RequestOTPByEmail,
  ): Promise<{message: string}> {
    if (this.currentUser.email && this.currentUser.email !== requestOTP.email) {
      throw new HttpErrors.UnprocessableEntity('EmailAlreadyRegistered');
    }

    if (!validator.isEmail(requestOTP.email)) {
      throw new HttpErrors.UnprocessableEntity('Invalid Email Address');
    }

    const {email, callbackURL} = requestOTP;
    const key = `email-request/${this.currentUser[securityId]}`;
    await Promise.all([
      this.userOTPService.requestByEmail(email, callbackURL, this.currentUser),
      this.changeEmailRequestRepository.set(key, {email}),
    ]);

    await this.changeEmailRequestRepository.expire(key, 30 * 60 * 1000);

    return {
      message: `OTP sent to ${requestOTP.email}`,
    };
  }

  // ------------------------------------------------
  // ------ Experience ------------------------------

  public async userExperience(
    id: string,
    filter?: Filter<UserExperience>,
  ): Promise<UserExperience> {
    return this.userExperienceService.findById(id, filter, true);
  }

  public async userExperiences(
    filter?: Filter<UserExperience>,
  ): Promise<UserExperience[]> {
    return this.userExperienceService.find(filter, true);
  }

  public async createExperience(
    experince: Omit<Experience, 'id'>,
    clonedId?: string,
  ): Promise<Experience> {
    return this.userExperienceService.create(experince, clonedId);
  }

  public async subscribeExperience(id: string): Promise<UserExperience> {
    return this.userExperienceService.subscribe(id);
  }

  public async updateExperience(
    id: string,
    experience: Partial<Experience>,
  ): Promise<Count> {
    return this.userExperienceService.update(id, experience);
  }

  public async unsubscribeExperience(id: string): Promise<void> {
    return this.userExperienceService.unsubscribe(id);
  }

  // ------------------------------------------------

  // ------ Post ------------------------------------

  public async posts(filter?: Filter<Post>): Promise<Post[]> {
    return this.postService.find(
      filter,
      undefined,
      true,
      this.currentUser[securityId],
    );
  }

  public async post(id: string, filter?: Filter<Post>): Promise<Post> {
    return this.postService.findById(
      id,
      filter,
      true,
      this.currentUser[securityId],
    );
  }

  public async draftPost(): Promise<DraftPost | null> {
    return this.postService.draft(this.currentUser[securityId]);
  }

  public async createPost(draftPost: DraftPost): Promise<DraftPost | Post> {
    draftPost.createdBy = this.currentUser[securityId];
    return this.postService.create(draftPost);
  }

  public async importPost(importedPost: CreateImportedPostDto): Promise<Post> {
    importedPost.importer = this.currentUser[securityId];
    return this.postService.import(importedPost);
  }

  public async updatePost(id: string, data: Partial<Post>): Promise<Count> {
    data.createdBy = this.currentUser[securityId];
    return this.postService.updateById(id, data);
  }

  public async removePost(id: string, post?: Post): Promise<Count> {
    return this.postService.deleteById(id, this.currentUser[securityId], post);
  }

  // ------------------------------------------------

  // ------ Comment ---------------------------------

  public async comments(filter?: Filter<Comment>): Promise<Comment[]> {
    return this.commentService.find(filter);
  }

  public async createComment(comment: Omit<Comment, 'id'>): Promise<Comment> {
    comment.userId = this.currentUser[securityId];
    return this.commentService.create(comment);
  }

  public async removeComment(id: string): Promise<Comment> {
    return this.commentService.deleteById(id, this.currentUser[securityId]);
  }

  // ------------------------------------------------

  // ------ Transaction -----------------------------

  public async transactions(
    filter?: Filter<Transaction>,
  ): Promise<Transaction[]> {
    return this.transactionService.find(filter);
  }

  public async createTransaction(
    transaction: Omit<Transaction, 'id'>,
  ): Promise<Transaction> {
    return this.transactionService.create(transaction);
  }

  public async updateTransaction(data: UpdateTransactionDto): Promise<void> {
    return this.transactionService.patch(data);
  }

  // ------------------------------------------------

  // ------ Currency --------------------------------

  public async setCurrencyPriority(priority: Priority): Promise<void> {
    return this.currencyService.setPriority(
      this.currentUser[securityId],
      priority.currencyIds,
    );
  }

  public async currencies(
    filter?: Filter<UserCurrency>,
  ): Promise<UserCurrency[]> {
    return this.userRepository
      .userCurrencies(this.currentUser[securityId])
      .find(filter);
  }

  // ------------------------------------------------

  // ------ Friend ----------------------------------

  public async friends(filter?: Filter<Friend>): Promise<Friend[]> {
    return this.friendService.find(filter);
  }

  public async requestFriend(friend: Omit<Friend, 'id'>): Promise<Friend> {
    return this.friendService.request(friend);
  }

  public async respondFriend(
    id: string,
    friend: Partial<Friend>,
  ): Promise<void> {
    return this.friendService.respond(id, new Friend(friend));
  }

  public async removeFriend(id: string, friend?: Friend): Promise<void> {
    return this.friendService.remove(id, friend);
  }

  // ------------------------------------------------

  // ------ Notification ----------------------------

  public async notifications(
    filter?: Filter<Notification>,
  ): Promise<Notification[]> {
    return this.notificationService.find(filter);
  }

  public async notificationCount(where?: Where<Notification>): Promise<Count> {
    return this.notificationService.count(where);
  }

  public async readNotifications(id?: string): Promise<Count> {
    return this.notificationService.read(id);
  }

  // ------------------------------------------------

  // ------ PrivateMethod ---------------------------

  public async actionCount(): Promise<Count | undefined> {
    if (this.currentUser?.fullAccess) return;
    const userId = this.currentUser?.[securityId] ?? '';
    const now = new Date().setHours(0, 0, 0, 0);
    const [{count: countComment}, {count: countPost}] = await Promise.all([
      this.commentService.count({
        userId,
        createdAt: {
          gt: new Date(now).toString(),
        },
      }),
      this.postService.count({
        createdBy: userId,
        createdAt: {
          gt: new Date(now).toString(),
        },
      }),
    ]);

    const actions = 6;
    return {count: actions - (countComment + countPost)};
  }

  // ------------------------------------------------

  // ------ UserWhereBuilder ------------------------

  public async searchName(where: Where<User>, name?: string) {
    const blockedFriendIds = await this.friendService.getFriendIds(
      this.currentUser[securityId],
      FriendStatusType.BLOCKED,
      true,
    );

    if (name) {
      Object.assign(where, {
        or: [
          {
            username: {
              like: `.*${name}`,
              options: 'i',
            },
          },
          {
            name: {
              like: `.*${name}`,
              options: 'i',
            },
          },
        ],
      });
    }

    Object.assign(where, {
      id: {
        nin: blockedFriendIds,
      },
      deletedAt: {
        $eq: null,
      },
    });
  }

  public async searchFriend(
    where: Where<User>,
    name: string,
    userId?: string,
  ): Promise<AnyObject | void> {
    if (!userId) throw new HttpErrors.UnprocessableEntity('UserIdMustBeFilled');

    if (name) {
      const [requestor, friends] = await Promise.all([
        this.userRepository.findById(userId),
        this.friendService.find({
          where: <AnyObject>{
            requestorId: userId,
            status: FriendStatusType.APPROVED,
            deletedAt: {
              $eq: null,
            },
          },
        }),
      ]);

      if (friends.length > 0) {
        const userIds: AnyObject = {};
        const friendIds = friends.map(friend => {
          userIds[friend.requesteeId] = friend.id;
          return friend.requesteeId;
        });

        Object.assign(where, {
          id: {inq: friendIds},
          name: {
            like: `${encodeURI(name)}.*`,
            options: 'i',
          },
          deletedAt: {
            $eq: null,
          },
        });

        return {
          userIds,
          requestor,
        };
      }
    }
  }

  public async mutualUserIds(
    where: Where<User>,
    requestorId?: string,
    requesteeId?: string,
  ) {
    if (!(requestorId && requesteeId)) {
      throw new HttpErrors.UnprocessableEntity(
        'RequesteeIdAndRequestorIdMustBeFilled',
      );
    }

    const userIds = this.friendService.getMutualUserIds(
      requestorId,
      requesteeId,
    );

    Object.assign(where, {
      id: {inq: userIds},
      deletedAt: {
        $eq: null,
      },
    });
  }

  public async onBoardUserRewardList(
    where: Where<User>,
    month: number,
    year: number,
  ) {
    try {
      const newUsers = await this.find({
        where: {
          and: [
            {
              createdAt: {
                gt: new Date(year, month, 1).toString(),
              },
            },
            {
              createdAt: {
                lt: new Date(year, month + 1, 0).toString(),
              },
            },
          ],
        },
        include: [
          {
            relation: 'people',
          },
        ],
      });

      const newUsersConnectedSocialMedia = newUsers.filter(
        user => user.people?.length >= 1,
      );

      let importers: string[] = [];
      let tippers: string[] = [];
      for (const user of newUsersConnectedSocialMedia) {
        const posts = await this.postService.find({
          where: {
            and: [
              {
                platform: {
                  nin: [PlatformType.MYRIAD],
                },
              },
              {
                peopleId: {
                  inq: user.people.map(people => people.id),
                },
              },
              {
                createdAt: {
                  lt: user.createdAt,
                },
              },
            ],
          },
        });

        const trxs = await this.transactionService.find({
          where: {
            type: ReferenceType.POST,
            referenceId: {
              inq: posts.map(post => post.id),
            },
            createdAt: {
              lt: user.createdAt,
            },
          },
          include: [
            {
              relation: 'fromUser',
            },
          ],
        });

        const importer = Array.from(new Set(posts.map(post => post.createdBy)));
        importers = Array.from(new Set([...importers, ...importer]));
        const tipper = Array.from(
          new Set(
            trxs.map(trx => trx.fromUser?.id ?? '').filter(id => id !== ''),
          ),
        );
        tippers = [...new Set([...tippers, ...tipper])];
      }

      const userIds = Array.from(new Set([...importers, ...tippers]));

      Object.assign(where, {
        id: {
          inq: userIds,
          deletedAt: {
            $eq: null,
          },
        },
      });
    } catch (err) {
      if (err.message === 'Invalid date: Invalid Date') {
        throw new HttpErrors.UnprocessableEntity('InvalidDate');
      }

      throw err;
    }
  }

  // ------------------------------------------------

  // ------ PrivateMethod ---------------------------

  private async afterConnectWallet(wallet: Wallet): Promise<Wallet> {
    const {id, userId, networkId} = wallet;
    const ng = new NonceGenerator();
    const newNonce = ng.generate();

    Promise.allSettled([
      this.userPermissions(userId, id),
      this.currencyService.create(userId, networkId),
      this.userRepository.updateById(userId, {
        nonce: newNonce,
        fullAccess: true,
      }),
    ]) as Promise<AnyObject>;

    return wallet;
  }

  private async afterSwitchNetwork(wallet: Wallet): Promise<Wallet> {
    const {networkId, userId} = wallet;
    const ng = new NonceGenerator();
    const newNonce = ng.generate();

    Promise.allSettled([
      this.currencyService.update(userId, networkId).then(() => {
        return Promise.all([
          this.userRepository.updateById(userId, {
            nonce: newNonce,
            fullAccess: true,
          }),
          this.walletRepository.updateAll(
            {primary: false},
            {networkId: {nin: [networkId]}, userId},
          ),
        ]);
      }),
    ]) as Promise<AnyObject>;

    return wallet;
  }

  private async afterUpdateProfile(
    user: Partial<UpdateUserDto>,
  ): Promise<void> {
    const jobs: Promise<ActivityLog>[] = [];

    if (user.profilePictureURL) {
      jobs.push(
        this.userRepository.activityLogs(this.currentUser[securityId]).create({
          type: ActivityLogType.UPLOADPROFILEPICTURE,
          userId: this.currentUser[securityId],
          referenceId: this.currentUser[securityId],
          referenceType: ReferenceType.USER,
        }),
      );
    }

    if (user.bannerImageURL) {
      jobs.push(
        this.userRepository.activityLogs(this.currentUser[securityId]).create({
          type: ActivityLogType.UPLOADBANNER,
          userId: this.currentUser[securityId],
          referenceId: this.currentUser[securityId],
          referenceType: ReferenceType.USER,
        }),
      );
    }

    if (user.bio) {
      jobs.push(
        this.userRepository.activityLogs(this.currentUser[securityId]).create({
          type: ActivityLogType.FILLBIO,
          userId: this.currentUser[securityId],
          referenceId: this.currentUser[securityId],
          referenceType: ReferenceType.USER,
        }),
      );
    }

    Promise.allSettled(jobs) as Promise<AnyObject>;
  }

  private async userPermissions(
    userId: string,
    registeredAddress: string,
  ): Promise<void> {
    try {
      const {getKeyring, getHexPublicKey} = new PolkadotJs();
      const mnemonic = config.MYRIAD_ADMIN_SUBSTRATE_MNEMONIC;

      const serverAdmin = getKeyring().addFromMnemonic(mnemonic);
      const address = getHexPublicKey(serverAdmin);

      if (registeredAddress !== address) return;
      await this.userRepository.updateById(userId, {
        permissions: [
          PermissionKeys.MASTER,
          PermissionKeys.ADMIN,
          PermissionKeys.USER,
        ],
      });
    } catch {
      // ignore
    }
  }

  // ------------------------------------------------
}

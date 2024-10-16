import {AuthenticationBindings} from '@loopback/authentication';
import {inject, InvocationArgs, service} from '@loopback/core';
import {
  AnyObject,
  Filter,
  // OrClause,
  repository,
  Where,
} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {Query} from 'express-serve-static-core';
import {pull} from 'lodash';
import {
  AccountSettingType,
  FriendStatusType,
  MethodType,
  OrderFieldType,
  OrderType,
  PlatformType,
  ReferenceType,
  SectionType,
  TimelineType,
  VisibilityType,
} from '../enums';
import {UserExperienceStatus} from '../enums/user-experience-status.enum';
import {
  ActivityLog,
  Comment,
  ConfigData,
  Experience,
  ExperiencePost,
  Friend,
  Post,
  SelectedUser,
  Timeline,
  Transaction,
  User,
  UserCurrency,
  UserReport,
  Wallet,
} from '../models';
import {
  AccountSettingRepository,
  ExperienceUserRepository,
  TagRepository,
  UserExperienceRepository,
  UserRepository,
  WalletRepository,
} from '../repositories';
import {TimelineConfigRepository} from '../repositories/timeline-config.repository';
import {generateObjectId} from '../utils/formatter';
import {CurrencyService} from './currency.service';
import {ExperienceService} from './experience.service';
import {FriendService} from './friend.service';
import {PostService} from './post.service';
import {TransactionService} from './transaction.service';

export class FilterBuilderService {
  constructor(
    @repository(AccountSettingRepository)
    private accountSettingRepository: AccountSettingRepository,
    @repository(TagRepository)
    private tagRepository: TagRepository,
    @repository(UserExperienceRepository)
    private userExperienceRepository: UserExperienceRepository,
    @repository(TimelineConfigRepository)
    private timelineConfigRepository: TimelineConfigRepository,
    @repository(UserRepository)
    private userRepository: UserRepository,
    @repository(WalletRepository)
    private walletRepository: WalletRepository,
    @service(CurrencyService)
    private currencyService: CurrencyService,
    @service(ExperienceService)
    private experienceService: ExperienceService,
    @repository(ExperienceUserRepository)
    private experienceUserRepository: ExperienceUserRepository,
    @service(FriendService)
    private friendService: FriendService,
    @service(PostService)
    private postService: PostService,
    @service(TransactionService)
    private transactionService: TransactionService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private currentUser: UserProfile,
  ) {}

  // ------------------------------------------------

  // ------ FilterBuilder ----------------------

  public async user(
    filter: Filter<AnyObject>,
    query: Query,
    methodName?: MethodType,
  ): Promise<AnyObject | void> {
    if (methodName === MethodType.LOG) {
      const where = await this.userLog();
      filter.where = {...filter.where, ...where};
      return;
    }

    let {requestorId, requesteeId, friendsName, airdrop, name} = query;

    if (Array.isArray(airdrop)) airdrop = airdrop[0];
    if (Array.isArray(requestorId)) requestorId = requestorId[0];
    if (Array.isArray(requesteeId)) requesteeId = requesteeId[0];
    if (Array.isArray(friendsName)) friendsName = friendsName[0];
    if (Array.isArray(name)) name = name[0];

    const hasWhere = Object.keys(filter?.where ?? {}).length > 0;

    if (
      (hasWhere &&
        (friendsName || requestorId || requesteeId || airdrop || name)) ||
      (airdrop &&
        (requestorId || requesteeId || hasWhere || friendsName || name)) ||
      (friendsName &&
        (requestorId || requesteeId || hasWhere || airdrop || name)) ||
      ((requestorId || requesteeId) &&
        (friendsName || hasWhere || airdrop || name))
    ) {
      throw new HttpErrors.UnprocessableEntity('WrongFilterFormat');
    }

    if (!friendsName) {
      filter.order = this.orderSetting(query).order;
    }

    if (airdrop === 'onboarding') {
      const {month, year} = query;
      const where = await this.userOnboardingRewardList(
        parseInt(month?.toString() ?? new Date().getMonth().toString()),
        parseInt(year?.toString() ?? new Date().getFullYear().toString()),
      );
      return this.finalizeFilter(filter, where);
    }

    if (typeof requestorId === 'string' || typeof requesteeId === 'string') {
      if (!requestorId) return this.defaultFilter(filter);
      if (!requesteeId) return this.defaultFilter(filter);
      const where = await this.userMutualFriends(
        requestorId.toString(),
        requesteeId.toString(),
      );
      return this.finalizeFilter(filter, where);
    }

    if (typeof friendsName === 'string') {
      if (!friendsName) return this.defaultFilter(filter);
      const {userId} = query;
      const [where, additional] = await this.searchUserFriends(
        friendsName.toString(),
        (Array.isArray(userId) ? userId[0] : userId)?.toString(),
      );
      filter.fields = ['id', 'name', 'username', 'profilePictureURL'];
      return this.finalizeFilter(filter, where, additional);
    }

    const where = await this.searchUserByName(name?.toString());
    return this.finalizeFilter(filter, where);
  }

  public async userComment(
    filter: Filter<Comment>,
    query: Query,
  ): Promise<AnyObject | void> {
    let {userId, referenceId, section, exclusiveInfo} = query;

    if (Array.isArray(userId)) userId = userId[0];
    if (Array.isArray(referenceId)) referenceId = referenceId[0];
    if (Array.isArray(section)) section = section[0];
    if (Array.isArray(exclusiveInfo)) exclusiveInfo = exclusiveInfo[0];

    if (exclusiveInfo === 'true') {
      const where: Where<Comment> = <AnyObject>{
        'asset.exclusiveContents': {$exists: true},
        userId: userId ?? this.currentUser[securityId],
      };

      return this.finalizeFilter(filter, where);
    }

    if (referenceId) {
      return this.finalizeFilter(filter, {
        referenceId,
        section: !section ? SectionType.DISCUSSION : section,
      });
    }

    return this.finalizeFilter(filter, {
      userId: userId ?? this.currentUser[securityId],
    });
  }

  public async userCurrency(
    filter: Filter<UserCurrency>,
    query: Query,
  ): Promise<AnyObject | void> {
    let {q} = query;

    // search currency
    if (Array.isArray(q)) q = q[0];
    if (typeof q === 'string') {
      if (!q) return this.defaultFilter(filter);
      const pattern = new RegExp(q.toString(), 'i');
      const currencies = await this.currencyService.find({
        where: {
          or: [{name: {regexp: pattern}}, {symbol: {regexp: pattern}}],
        },
      });
      const currencyIds = currencies.map(currency => currency.id);
      return this.finalizeFilter(filter, {currencyId: {inq: currencyIds}});
    }

    const wallet = await this.walletRepository.findOne({
      where: {
        userId: this.currentUser?.[securityId] ?? '',
        primary: true,
      },
    });

    const networkId = wallet?.networkId ?? '';
    const userId = wallet?.userId ?? '';

    filter.order = ['priority ASC'];

    await this.currencyService.update(this.currentUser[securityId], networkId);

    return this.finalizeFilter(filter, {userId, networkId});
  }

  public async userFriend(
    filter: Filter<Friend>,
    query: Query,
  ): Promise<AnyObject | void> {
    let {status, userId} = query;

    if (Array.isArray(status)) status = status[0];
    if (Array.isArray(userId)) userId = userId[0];

    filter.where = {...filter.where, status, deletedAt: {$eq: null}} as Where;

    switch (status) {
      case FriendStatusType.PENDING:
        return this.finalizeFilter(filter, {
          requesteeId: this.currentUser?.[securityId],
        });

      case FriendStatusType.BLOCKED:
        if (!userId) return this.defaultFilter(filter);
        return this.finalizeFilter(filter, {
          or: [{requestorId: userId}, {requesteeId: userId}],
        });

      case FriendStatusType.APPROVED: {
        if (!userId) return this.defaultFilter(filter);
        if (userId !== this.currentUser[securityId]) {
          const asFriend = await this.friendService.asFriend(
            userId.toString(),
            this.currentUser[securityId],
          );

          if (!asFriend) {
            const isPrivate = await this.accountSettingRepository.findOne({
              where: {
                userId: userId.toString(),
                accountPrivacy: AccountSettingType.PRIVATE,
              },
            });

            if (isPrivate) return this.defaultFilter(filter);
          }
        }

        return this.finalizeFilter(filter, {requestorId: userId});
      }

      default:
        return this.defaultFilter(filter);
    }
  }

  public async userPost(
    filter: Filter<Post>,
    query: Query,
  ): Promise<AnyObject | void> {
    let {timelineType, q, topic} = query;

    if (Array.isArray(q)) q = q[0];
    if (Array.isArray(topic)) topic = topic[0];
    if (Array.isArray(timelineType)) timelineType = timelineType[0];

    if (
      (q && (topic || timelineType)) ||
      (topic && (q || timelineType)) ||
      (timelineType && (q || topic))
    ) {
      throw new HttpErrors.UnprocessableEntity(
        'Cannot used where filter together with q, topic, and timelineType',
      );
    }

    const currentInclude =
      filter?.include?.filter(e => {
        if (typeof e === 'string' && e === 'experiences') return false;
        if (typeof e === 'object' && e.relation === 'experiences') return false;
        return true;
      }) ?? [];

    const experienceFilter = {
      relation: 'experiences',
      scope: {
        limit: 1,
        order: ['name ASC'],
        where: {
          deletedAt: {
            $exists: false,
          },
        },
      },
    };

    const defaultInclude = ['user', experienceFilter];

    // Update the order and get the needsDateFilter flag
    const {order, needsDateFilter} = this.orderSetting(query);
    filter.order = order;

    filter.include = currentInclude.concat(defaultInclude);
    filter.where = {
      ...filter.where,
      banned: false,
      deletedAt: {$eq: null},
    } as Where;

    // Ensure date filter is added
    if (needsDateFilter) {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
      filter.where = {
        ...filter.where,
        originCreatedAt: {gte: twelveMonthsAgo.toISOString()},
      };
    }

    // Handle search queries
    if (typeof q === 'string') {
      if (q.length <= 3 && !q.match('^[A-Za-z0-9]')) {
        return this.defaultFilter(filter);
      }
      const where = await this.searchPostByQuery(q);
      return this.finalizeFilter(filter, where);
    }

    // search topic
    if (typeof topic === 'string') {
      if (!topic) return this.defaultFilter(filter);
      const where = await this.searchPostByHashtaq(topic.toString());
      return this.finalizeFilter(filter, where);
    }

    // get current timeline
    const where = await this.timelineFilter(timelineType?.toString(), query);
    return this.finalizeFilter(filter, where);
  }

  public async userExperienceById(args: InvocationArgs): Promise<void> {
    const filter = args[1] ?? {};
    const include = [
      {
        relation: 'experience',
        scope: {
          include: [
            {
              relation: 'user',
              scope: {
                include: [{relation: 'accountSetting'}],
              },
            },
          ],
        },
      },
    ];

    if (!filter.include) filter.include = include;
    else filter.include.push(...include);

    args[1] = filter;
  }

  public async userPostById(args: InvocationArgs): Promise<void> {
    const filter = args[1] ?? {};
    const experienceFilter = {
      relation: 'experiences',
      scope: {
        limit: 1,
        order: ['name ASC'],
        where: {
          deletedAt: {
            $exists: false,
          },
        },
      },
    };

    filter.include = filter.include
      ? [...filter.include, 'user', experienceFilter]
      : ['user', experienceFilter];

    args[1] = filter;
  }

  public async userTransaction(
    filter: Filter<Transaction>,
    query: Query,
  ): Promise<AnyObject | void> {
    let {referenceId, currencyId, referenceType, status} = query;

    if (Array.isArray(referenceType)) referenceType = referenceType[0];
    if (Array.isArray(currencyId)) currencyId = currencyId[0];
    if (Array.isArray(referenceId)) referenceId = referenceId[0];
    if (Array.isArray(status)) status = status[0];

    const profile = referenceType === ReferenceType.USER && referenceId;

    if (currencyId) {
      filter.where = {...filter.where, currencyId};
    }

    switch (referenceType) {
      case ReferenceType.POST:
      case ReferenceType.COMMENT:
        if (!referenceId) referenceId = generateObjectId();
        return this.finalizeFilter(filter, {referenceId, type: referenceType});

      default: {
        let userId;

        if (profile) {
          userId = referenceId ? referenceId.toString() : undefined;
          filter.where = {...filter.where, type: {nin: [ReferenceType.POST]}};
        }

        userId = userId ?? this.currentUser[securityId];

        if (status === 'received' || profile) {
          return this.finalizeFilter(filter, {to: userId});
        }

        if (status === 'sent') {
          return this.finalizeFilter(filter, {from: userId});
        }

        return this.finalizeFilter(filter, {
          or: [{from: userId}, {to: userId}],
        });
      }
    }
  }

  public async experience(
    filter: Filter<Experience>,
    query: Query,
  ): Promise<AnyObject | void> {
    const {createdBy} = query;
    let {q, postId, userId, visibility} = query;

    if (Array.isArray(q)) q = q[0];
    if (Array.isArray(postId)) postId = postId[0];
    if (Array.isArray(userId)) userId = userId[0];
    if (Array.isArray(visibility)) visibility = visibility[0];

    filter.where = {
      deletedAt: {$eq: null},
    } as Where;

    if (typeof q === 'string') {
      const matchWord = q.toString().match('^[A-Za-z0-9]');

      if (q.toString().length <= 3 && !matchWord) {
        return this.defaultFilter(filter);
      }

      const re = new RegExp('[^A-Za-z0-9 ]', 'gi');
      const experienceQuery = q.toString().replace(re, '');
      const where = await this.searchExperience(experienceQuery);
      return this.finalizeFilter(filter, {
        ...where,
        createdBy: createdBy,
      });
    }

    if (postId) {
      const includes =
        filter?.include?.filter(include => {
          if (typeof include === 'string' && include === 'posts') return false;
          if (typeof include === 'object' && include.relation === 'posts') {
            return false;
          }

          return true;
        }) ?? [];

      includes.push({
        relation: 'posts',
        scope: {
          where: {
            id: postId,
          },
        },
      });

      filter.include = includes;
      return this.finalizeFilter(filter, {
        createdBy: this.currentUser[securityId],
      });
    }

    if (userId === this.currentUser[securityId] && !visibility) {
      return this.finalizeFilter(filter, {createdBy: userId});
    }

    const visibilityType = visibility?.toString() as VisibilityType;
    const where = await this.experienceVisibility(
      visibilityType,
      userId?.toString(),
    );

    return this.finalizeFilter(filter, {
      ...where,
      createdBy: createdBy,
    });
  }

  public async experienceAdvanceSearch(
    filter: Filter<Experience>,
    query: Query,
  ): Promise<AnyObject | void> {
    const userId = this.currentUser[securityId];

    const approvedFriendIds = await this.friendService.getFriendIds(
      userId,
      FriendStatusType.APPROVED,
    );

    const {allowedTags, prohibitedTags, people} = query;

    // to collect query or condition
    const orCondition: AnyObject[] = [];

    // check if query people is not null and type of people is array
    // push condition to match with people field with id from people query
    // push condition to query by id in list experience id from query experience user by people
    if (people && Array.isArray(people)) {
      const peoplesMatcher = people.map(peopleId => ({
        people: {
          elemMatch: {
            id: peopleId,
          },
        },
      }));

      orCondition.push(...peoplesMatcher);

      const userExperiences = await this.experienceUserRepository.find({
        where: {
          userId: {inq: people as string[]},
        },
      });

      const experienceIdsPeople = userExperiences
        .filter((userExperience, index, userExperiencesCollection) => {
          const userExperienceIndex = userExperiencesCollection.findIndex(
            uec => uec.experienceId === userExperience.experienceId,
          );
          return index === userExperienceIndex;
        })
        .map(userExperience => {
          return userExperience.experienceId;
        });

      orCondition.push({
        id: {inq: experienceIdsPeople},
      });
    }

    if (allowedTags && Array.isArray(allowedTags) && allowedTags.length > 0) {
      orCondition.push({
        allowedTags: {inq: allowedTags},
      });
    }

    if (
      prohibitedTags &&
      Array.isArray(prohibitedTags) &&
      prohibitedTags.length > 0
    ) {
      orCondition.push({
        prohibitedTags: {inq: prohibitedTags},
      });
    }

    const filterVisiblity = {
      or: [
        {
          visibility: {eq: VisibilityType.PRIVATE},
          createdBy: {eq: userId},
        },
        {
          visibility: {eq: VisibilityType.SELECTED},
          'selectedUserIds.userId': {inq: [userId]},
        },
        {
          visibility: {eq: VisibilityType.FRIEND},
          createdBy: {inq: approvedFriendIds},
        },
        {
          visibility: {eq: VisibilityType.PUBLIC},
        },
        {
          visibility: {exists: false},
        },
      ],
    };

    const where: AnyObject = {
      and: [],
    };

    where.and.push(filterVisiblity);

    if (orCondition.length > 0) {
      where.and.push({
        or: orCondition,
      });
    }

    return this.finalizeFilter(filter, where);
  }

  public async experiencePost(
    filter: Filter<ExperiencePost>,
    args: InvocationArgs,
    query: Query,
  ): Promise<AnyObject | void> {
    const [id, currentFilter = {where: {}}] = args;

    Object.assign(filter, currentFilter);

    filter.where = {...currentFilter.where, deletedAt: {$eq: null}} as Where;

    const {order, needsDateFilter} = this.orderSetting(query);
    filter.order = order;

    if (needsDateFilter) {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

      filter.where = {
        ...filter.where,
        createdAt: {gte: twelveMonthsAgo.toISOString()},
      };
    }

    const where = await this.searchPostByExperience(id);
    return this.finalizeFilter(filter, where);
  }

  public async post(
    filter: Filter<Post>,
    args: InvocationArgs,
    query: Query,
  ): Promise<AnyObject | void> {
    let [originPostId, platform, importerFilter = {where: {}}] = args;

    if (Array.isArray(originPostId)) originPostId = originPostId[0];
    if (Array.isArray(platform)) platform = platform[0];
    if (Array.isArray(importerFilter)) importerFilter = importerFilter[0];

    const {order, needsDateFilter} = this.orderSetting(query);
    filter.order = order;

    if (needsDateFilter) {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

      filter.where = {
        ...filter.where,
        createdAt: {gte: twelveMonthsAgo.toISOString()},
      };
    }

    filter.include = ['user'];
    return this.finalizeFilter(filter, {
      ...importerFilter.where,
      originPostId,
      platform,
    });
  }

  public async postExperience(
    filter: Filter<Experience>,
    args: InvocationArgs,
    query: Query,
  ): Promise<AnyObject | void> {
    const {order, needsDateFilter} = this.orderSetting(query);
    filter.order = order;

    if (needsDateFilter) {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

      filter.where = {
        ...filter.where,
        createdAt: {gte: twelveMonthsAgo.toISOString()},
      };
    }

    filter.include = args[1]?.include ?? [];
    return this.finalizeFilter(filter, {deletedAt: {$eq: null}});
  }

  public async reportUser(
    filter: Filter<UserReport>,
    args: InvocationArgs,
    query: Query,
  ): Promise<AnyObject | void> {
    const {order} = this.orderSetting(query);
    filter.order = order;

    filter.include = ['reporter'];
    return this.finalizeFilter(filter, {reportId: args[0]});
  }

  public async userWallet(filter: Filter<Wallet>, args: InvocationArgs) {
    Object.assign(filter, args[1] ?? {});
    return this.finalizeFilter(filter, {});
  }

  // ------------------------------------------------

  // ------ UserWhereBuilder ------------------------

  private async userLog(): Promise<Where<ActivityLog>> {
    return {
      userId: this.currentUser[securityId],
    };
  }

  private async userMutualFriends(
    requestorId: string,
    requesteeId: string,
  ): Promise<Where<User>> {
    const collection = this.friendService.collection();
    const friends = await collection
      .aggregate([
        {
          $match: {
            $or: [
              {
                requestorId: requestorId,
                status: FriendStatusType.APPROVED,
              },
              {
                requestorId: requesteeId,
                status: FriendStatusType.APPROVED,
              },
            ],
          },
        },
        {$group: {_id: '$requesteeId', count: {$sum: 1}}},
        {$match: {count: 2}},
        {$project: {_id: 1}},
      ])
      .get();

    const ids = friends?.map((friend: AnyObject) => friend._id);

    return {
      id: <AnyObject>{
        inq: ids,
        deletedAt: {
          $eq: null,
        },
      },
    };
  }

  private async userOnboardingRewardList(
    month: number,
    year: number,
  ): Promise<Where<User>> {
    const newUsers = await this.userRepository.find({
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

    return {
      id: <AnyObject>{
        inq: userIds,
        deletedAt: {
          $eq: null,
        },
      },
    };
  }

  private async searchUserByName(name?: string): Promise<Where<User>> {
    const where: Where<User> = {};
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
      and: [{id: {nin: blockedFriendIds}}, {deletedAt: {$eq: null}}],
    });

    return where;
  }

  private async searchUserFriends(
    name: string,
    userId?: string,
  ): Promise<[Where<User>, AnyObject]> {
    if (name && userId) {
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

        return [
          {
            id: {inq: friendIds},
            name: <AnyObject>{
              like: `${encodeURI(name)}.*`,
              options: 'i',
            },
            deletedAt: <AnyObject>{
              $eq: null,
            },
          },
          {
            userIds,
            requestor,
          },
        ];
      }
    }

    return [{id: generateObjectId()}, {userIds: [], requestor: new User()}];
  }

  // ------------------------------------------------

  // ------ PostWhereBuilder ------------------------

  private async searchPostByQuery(q: string): Promise<Where<Post>> {
    let text = q;

    if (text.length > 1) {
      if (text[0] === '@' || text[0] === '#') {
        const re =
          text[0] === '@'
            ? new RegExp('[^A-Za-z0-9 _]', 'gi')
            : new RegExp('[^A-Za-z0-9]', 'gi');
        text = text[0] + text.substr(1).replace(re, '');
      } else {
        text = text.replace(new RegExp('[^A-Za-z0-9 ]', 'gi'), '');
      }
    }

    text = text.trim();

    // Apply date filter to limit posts to the last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    const dateFilter = {originCreatedAt: {gte: twelveMonthsAgo.toISOString()}};

    const currentUser = this.currentUser[securityId];
    const [approvedFriendIds, blockedFriends] = await Promise.all([
      this.friendService.getFriendIds(currentUser, FriendStatusType.APPROVED),
      this.friendService.getFriendIds(currentUser, FriendStatusType.BLOCKED),
    ]);

    // Remove approved friends from the blocked friends list
    const blockedFriendIds = blockedFriends.filter(
      id => !approvedFriendIds.includes(id),
    );

    // Initialize the filterPost array by searching posts by username
    const filterPost: AnyObject[] = await this.searchPostByUserName(
      approvedFriendIds,
      blockedFriendIds,
      q,
    );

    if (q.startsWith('#')) {
      const hashtag = q.replace('#', '').trim().toLowerCase();
      const hashtagRegexp = new RegExp(`#${hashtag}\\b`, 'i');

      filterPost.push(
        {
          and: [
            {tags: {inq: [[hashtag]]}},
            {visibility: VisibilityType.PUBLIC},
            {createdBy: {nin: blockedFriendIds}},
            dateFilter,
          ],
        },
        {
          and: [
            {tags: {inq: [[hashtag]]}},
            {visibility: VisibilityType.FRIEND},
            {createdBy: {inq: approvedFriendIds}},
            dateFilter,
          ],
        },
        {
          and: [
            {tags: {inq: [[hashtag]]}},
            {visibility: VisibilityType.SELECTED},
            {selectedUserIds: {inq: [currentUser]}},
            {createdBy: {nin: blockedFriendIds}},
            dateFilter,
          ],
        },
        {
          and: [{tags: {inq: [hashtag]}}, {createdBy: currentUser}, dateFilter],
        },
        {
          and: [
            {rawText: {regexp: hashtagRegexp}},
            {visibility: VisibilityType.PUBLIC},
            {createdBy: {nin: blockedFriendIds}},
            dateFilter,
          ],
        },
        {
          and: [
            {rawText: {regexp: hashtagRegexp}},
            {visibility: VisibilityType.FRIEND},
            {createdBy: {inq: approvedFriendIds}},
            dateFilter,
          ],
        },
        {
          and: [
            {rawText: {regexp: hashtagRegexp}},
            {visibility: VisibilityType.SELECTED},
            {selectedUserIds: {inq: [currentUser]}},
            {createdBy: {nin: blockedFriendIds}},
            dateFilter,
          ],
        },
        {
          and: [
            {rawText: {regexp: hashtagRegexp}},
            {createdBy: currentUser},
            dateFilter,
          ],
        },
      );
    } else if (q.startsWith('@')) {
      const mention = q.replace('@', '').trim();
      const mentionRegexp = new RegExp(`@${mention}\\b`, 'i');

      filterPost.push(
        {
          and: [
            {mentions: {elemMatch: {name: mention}}},
            {visibility: VisibilityType.PUBLIC},
            {createdBy: {nin: blockedFriendIds}},
            dateFilter,
          ],
        },
        {
          and: [
            {mentions: {elemMatch: {name: mention}}},
            {visibility: VisibilityType.FRIEND},
            {createdBy: {inq: approvedFriendIds}},
            dateFilter,
          ],
        },
        {
          and: [
            {mentions: {elemMatch: {name: mention}}},
            {createdBy: currentUser},
            dateFilter,
          ],
        },
        {
          and: [
            {mentions: {elemMatch: {username: mention}}},
            {visibility: VisibilityType.PUBLIC},
            {createdBy: {nin: blockedFriendIds}},
            dateFilter,
          ],
        },
        {
          and: [
            {mentions: {elemMatch: {username: mention}}},
            {visibility: VisibilityType.FRIEND},
            {createdBy: {inq: approvedFriendIds}},
            dateFilter,
          ],
        },
        {
          and: [
            {mentions: {elemMatch: {username: mention}}},
            {visibility: VisibilityType.SELECTED},
            {selectedUserIds: {inq: [currentUser]}},
            {createdBy: {nin: blockedFriendIds}},
            dateFilter,
          ],
        },
        {
          and: [
            {mentions: {elemMatch: {username: mention}}},
            {createdBy: currentUser},
            dateFilter,
          ],
        },
        {
          and: [
            {rawText: {regexp: mentionRegexp}},
            {visibility: VisibilityType.PUBLIC},
            {createdBy: {nin: blockedFriendIds}},
            dateFilter,
          ],
        },
        {
          and: [
            {rawText: {regexp: mentionRegexp}},
            {visibility: VisibilityType.FRIEND},
            {createdBy: {inq: approvedFriendIds}},
            dateFilter,
          ],
        },
        {
          and: [
            {rawText: {regexp: mentionRegexp}},
            {visibility: VisibilityType.SELECTED},
            {selectedUserIds: {inq: [currentUser]}},
            {createdBy: {nin: blockedFriendIds}},
            dateFilter,
          ],
        },
        {
          and: [
            {rawText: {regexp: mentionRegexp}},
            {createdBy: currentUser},
            dateFilter,
          ],
        },
      );
    } else {
      const regexTopic = new RegExp(`\\b${q}\\b`, 'i');

      filterPost.push(
        {
          and: [
            {rawText: {regexp: regexTopic}},
            {visibility: VisibilityType.PUBLIC},
            {createdBy: {nin: blockedFriendIds}},
            dateFilter,
          ],
        },
        {
          and: [
            {rawText: {regexp: regexTopic}},
            {visibility: VisibilityType.FRIEND},
            {createdBy: {inq: approvedFriendIds}},
            dateFilter,
          ],
        },
        {
          and: [
            {rawText: {regexp: regexTopic}},
            {visibility: VisibilityType.SELECTED},
            {selectedUserIds: {inq: [currentUser]}},
            {createdBy: {nin: blockedFriendIds}},
            dateFilter,
          ],
        },
        {
          and: [
            {rawText: {regexp: regexTopic}},
            {createdBy: currentUser},
            dateFilter,
          ],
        },
      );
    }

    return {or: filterPost};
  }

  private async searchPostByHashtaq(topic: string): Promise<Where<Post>> {
    const hashtag = topic.toLowerCase();
    const currentUser = this.currentUser[securityId];
    const [approvedFriendIds, blockedFriends] = await Promise.all([
      this.friendService.getFriendIds(currentUser, FriendStatusType.APPROVED),
      this.friendService.getFriendIds(currentUser, FriendStatusType.BLOCKED),
    ]);

    const blockedFriendIds = pull(blockedFriends, ...approvedFriendIds);
    return {
      or: [
        {
          and: [
            {createdBy: {nin: blockedFriendIds}},
            {tags: {inq: [hashtag]}} as Where,
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [
            {createdBy: {inq: approvedFriendIds}},
            {tags: {inq: [hashtag]}} as Where,
            {visibility: VisibilityType.FRIEND},
          ],
        },
        {
          and: [
            {selectedUserIds: {inq: [this.currentUser[securityId]]}},
            {tags: {inq: [hashtag]}} as Where,
            {visibility: VisibilityType.SELECTED},
            {createdBy: {nin: blockedFriendIds}},
          ],
        },
        {
          and: [
            {createdBy: this.currentUser[securityId]},
            {tags: {inq: [hashtag]}} as Where,
          ],
        },
      ],
    };
  }

  private async searchPostByExperience(id: string): Promise<Where<Post>> {
    const userId = this.currentUser[securityId];
    return Promise.all([
      this.experienceService.getExperiencePostId(id),
      this.friendService.getFriendIds(userId, FriendStatusType.APPROVED),
      this.friendService.getFriendIds(userId, FriendStatusType.BLOCKED),
    ]).then(([postIds, friends, blockedFriendIds]) => {
      const blocked = pull(blockedFriendIds, ...friends);
      return {
        or: [
          {
            and: [
              {id: {inq: postIds}},
              {createdBy: {nin: blocked}},
              {visibility: VisibilityType.PUBLIC},
            ],
          },
          {
            and: [
              {id: {inq: postIds}},
              {createdBy: {inq: friends}},
              {visibility: VisibilityType.FRIEND},
            ],
          },
          {
            and: [
              {id: {inq: postIds}},
              {visibility: VisibilityType.SELECTED},
              {selectedUserIds: {inq: [userId]}},
              {createdBy: {nin: blocked}},
            ],
          },
          {
            and: [{id: {inq: postIds}}, {createdBy: {inq: [userId]}}],
          },
        ],
      } as Where<Post>;
    });
  }

  private async timelineByAll(): Promise<Where<Post>> {
    const userId = this.currentUser[securityId];
    return Promise.all([
      this.friendService.getFriendIds(userId, FriendStatusType.APPROVED),
      this.friendService.getFriendIds(userId, FriendStatusType.BLOCKED),
    ]).then(([friends, blockedFriendIds]) => {
      const blocked = pull(blockedFriendIds, ...friends);

      return {
        or: [
          {
            and: [
              {createdBy: {nin: blocked}},
              {visibility: VisibilityType.PUBLIC},
            ],
          },
          {
            and: [
              {createdBy: {inq: friends}},
              {visibility: VisibilityType.FRIEND},
            ],
          },
          {
            and: [
              {selectedUserIds: {inq: [this.currentUser[securityId]]}},
              {visibility: VisibilityType.SELECTED},
              {createdBy: {nin: blockedFriendIds}},
            ],
          },
          {createdBy: userId},
        ],
      };
    });
  }

  private async defaulTimeline(platform?: string): Promise<Where<Post>> {
    const userId = this.currentUser[securityId];
    const status = FriendStatusType.BLOCKED;
    const blockedIds = await this.friendService.getFriendIds(userId, status);
    const where: Where<Post> = {
      visibility: VisibilityType.PUBLIC,
      createdBy: {nin: blockedIds},
    };

    if (platform === 'myriad') {
      where.platform = PlatformType.MYRIAD;
    }

    if (platform === 'imported') {
      where.platform = {
        inq: [PlatformType.TWITTER, PlatformType.REDDIT, PlatformType.FACEBOOK],
      };
    }

    return where;
  }

  private async timelineByProfile(
    owner: string,
    platform?: string,
  ): Promise<Where<Post>> {
    const userId = this.currentUser[securityId];
    const or: Where<Post>[] = [];
    const condition: Where<Post> = {};

    if (owner !== userId) {
      let isPrivate = false;

      const asFriend = await this.friendService.asFriend(
        owner.toString(),
        userId,
      );

      if (asFriend) {
        or.push({
          createdBy: owner.toString(),
          visibility: {
            inq: [VisibilityType.FRIEND, VisibilityType.PUBLIC],
          },
        });
      } else {
        const accountSetting = await this.accountSettingRepository.findOne({
          where: {
            userId: owner.toString(),
            accountPrivacy: AccountSettingType.PRIVATE,
          },
        });

        isPrivate = Boolean(accountSetting);

        if (!isPrivate) {
          or.push({
            createdBy: owner.toString(),
            visibility: VisibilityType.PUBLIC,
          });
        }
      }

      if (!isPrivate) {
        or.push(<Where>{
          createdBy: owner.toString(),
          visibility: VisibilityType.SELECTED,
          selectedUserIds: {inq: [userId]},
        });
      } else {
        or.push({id: ''});
      }
    } else {
      or.push({createdBy: owner.toString()});
    }

    if (platform === 'myriad') {
      condition.platform = PlatformType.MYRIAD;
    }

    if (platform === 'imported') {
      condition.platform = {
        inq: [PlatformType.TWITTER, PlatformType.REDDIT, PlatformType.FACEBOOK],
      };
    }

    return {
      ...condition,
      or,
    };
  }

  private async timelineByFriend(): Promise<Where<Post>> {
    const userId = this.currentUser[securityId];
    const approvedFriendIds = await this.friendService.getFriendIds(
      userId,
      FriendStatusType.APPROVED,
    );

    if (!approvedFriendIds.length) return {id: ''};

    return {
      or: [
        {
          and: [
            {createdBy: {inq: approvedFriendIds}},
            {visibility: VisibilityType.FRIEND},
          ],
        },
        {
          and: [
            {createdBy: {inq: approvedFriendIds}},
            {visibility: VisibilityType.PUBLIC},
          ],
        },
      ],
    };
  }

  private async timelineByTrending(): Promise<Where<Post>> {
    const userId = this.currentUser[securityId];
    const trendingTopics = await this.tagRepository.find({
      order: [
        `${OrderFieldType.COUNT} ${OrderType.DESC}`,
        `${OrderFieldType.UPDATEDAT} ${OrderType.DESC}`,
      ],
      limit: 5,
    });

    const trendingTopicIds = trendingTopics.map(tag => tag.id);

    if (!trendingTopicIds.length) return {id: ''};

    const [approvedFriendIds, blockedFriendIds] = await Promise.all([
      this.friendService.getFriendIds(userId, FriendStatusType.APPROVED),
      this.friendService.getFriendIds(userId, FriendStatusType.BLOCKED),
    ]);

    const blocked = pull(blockedFriendIds, ...approvedFriendIds);

    return {
      or: [
        {
          and: [
            {tags: {inq: trendingTopicIds}} as Where,
            {createdBy: {nin: blocked}},
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [
            {tags: {inq: trendingTopicIds}} as Where,
            {createdBy: {inq: approvedFriendIds}},
            {visibility: VisibilityType.FRIEND},
          ],
        },
        {
          and: [
            {tags: {inq: trendingTopicIds}} as Where,
            {selectedUserIds: {inq: [this.currentUser[securityId]]}},
            {visibility: VisibilityType.SELECTED},
            {createdBy: {nin: blockedFriendIds}},
          ],
        },
        {
          and: [{tags: {inq: trendingTopicIds}} as Where, {createdBy: userId}],
        },
      ],
    };
  }

  private async timelineByExperience(
    currentUserId: string,
    config: Timeline,
    approvedIds: string[],
    blockedIds: string[],
    selected?: SelectedUser,
  ): Promise<Where<Post>[]> {
    const experienceUserIds: string[] = [];
    const {allowedTags, prohibitedTags, peopleIds, userIds} = config;
    const [expFriends, accountSettings] = await Promise.all([
      this.friendService.find({
        where: {
          requestorId: currentUserId,
          requesteeId: {inq: userIds},
          status: FriendStatusType.APPROVED,
        },
      }),
      this.accountSettingRepository.find({
        where: {userId: {inq: userIds}},
      }),
    ]);
    const expFriendIds = expFriends.map(friend => friend.requesteeId);
    const blocked = pull(blockedIds, ...expFriendIds, ...approvedIds);

    if (accountSettings.length > 0) {
      for (const accountSetting of accountSettings) {
        const accountPrivacy = accountSetting.accountPrivacy;
        const privateSetting = AccountSettingType.PRIVATE;

        if (accountPrivacy === privateSetting) {
          const found = expFriendIds.find(id => id === accountSetting.userId);
          if (found) experienceUserIds.push(accountSetting.userId);
        } else {
          experienceUserIds.push(accountSetting.userId);
        }
      }
    }

    const field = `addedAt.${config.timelineId}`;

    return [
      // Visibility PUBLIC
      {
        and: [
          {tags: {nin: prohibitedTags}} as Where,
          {createdBy: {nin: blocked}},
          {visibility: VisibilityType.PUBLIC},
          {[field]: {gte: selected?.addedAt ?? Date.now() + 60 * 60 * 1000}},
        ],
      },
      {
        and: [
          {tags: {inq: allowedTags}} as Where,
          {tags: {nin: prohibitedTags}} as Where,
          {createdBy: {nin: blocked}},
          {visibility: VisibilityType.PUBLIC},
        ],
      },
      {
        and: [
          {peopleId: {inq: peopleIds}},
          {tags: {nin: prohibitedTags}} as Where,
          {createdBy: {nin: blocked}},
          {visibility: VisibilityType.PUBLIC},
        ],
      },
      {
        and: [
          {tags: {nin: prohibitedTags}} as Where,
          {createdBy: {inq: experienceUserIds}},
          {visibility: VisibilityType.PUBLIC},
        ],
      },
      // Visibility SELECTED USER
      {
        and: [
          {tags: {nin: prohibitedTags}} as Where,
          {createdBy: {nin: blocked}},
          {selectedUserIds: {inq: [this.currentUser[securityId]]}},
          {visibility: VisibilityType.SELECTED},
          {[field]: {gte: selected?.addedAt ?? Date.now() + 60 * 60 * 1000}},
        ],
      },
      {
        and: [
          {tags: {inq: allowedTags}} as Where,
          {tags: {nin: prohibitedTags}} as Where,
          {createdBy: {nin: blocked}},
          {selectedUserIds: {inq: [this.currentUser[securityId]]}},
          {visibility: VisibilityType.SELECTED},
        ],
      },
      {
        and: [
          {peopleId: {inq: peopleIds}},
          {tags: {nin: prohibitedTags}} as Where,
          {createdBy: {nin: blocked}},
          {selectedUserIds: {inq: [this.currentUser[securityId]]}},
          {visibility: VisibilityType.SELECTED},
        ],
      },
      // // Visibility FRIEND
      {
        and: [
          {tags: {nin: prohibitedTags}} as Where,
          {createdBy: {inq: expFriendIds}},
          {visibility: VisibilityType.FRIEND},
          {[field]: {gte: selected?.addedAt ?? Date.now() + 60 * 60 * 1000}},
        ],
      },
      {
        and: [
          {tags: {inq: allowedTags}} as Where,
          {tags: {nin: prohibitedTags}} as Where,
          {createdBy: {inq: expFriendIds}},
          {visibility: VisibilityType.FRIEND},
        ],
      },
      {
        and: [
          {peopleId: {inq: peopleIds}},
          {tags: {nin: prohibitedTags}} as Where,
          {createdBy: {inq: expFriendIds}},
          {visibility: VisibilityType.FRIEND},
        ],
      },
      // CurrentUser
      {
        and: [
          {tags: {inq: allowedTags}} as Where,
          {tags: {nin: prohibitedTags}} as Where,
          {createdBy: currentUserId},
        ],
      },
      {
        and: [
          {peopleId: {inq: peopleIds}},
          {tags: {nin: prohibitedTags}} as Where,
          {createdBy: currentUserId},
        ],
      },
      {
        and: [
          {tags: {nin: prohibitedTags}} as Where,
          {createdBy: this.currentUser[securityId]},
          {[field]: {gte: selected?.addedAt ?? Date.now() + 60 * 60 * 1000}},
        ],
      },
    ];
  }

  private async searchPostByUserName(
    approvedFriendIds: string[],
    blockedFriendIds: string[],
    q: string,
  ): Promise<Where<Post>[]> {
    const pattern = new RegExp(`\\b${q}\\b`, 'i');
    const filterUser: Where<User>[] = [
      {
        and: [{name: {regexp: pattern}}, {id: {nin: blockedFriendIds}}],
      },
      {
        and: [{name: {regexp: pattern}}, {id: {inq: approvedFriendIds}}],
      },
    ];
    if (!q.match(/^#|^@/)) {
      filterUser.push(
        {
          and: [{username: {regexp: pattern}}, {id: {nin: blockedFriendIds}}],
        },
        {
          and: [{username: {regexp: pattern}}, {id: {inq: approvedFriendIds}}],
        },
      );
    }
    const nonDeletedUser = {
      or: filterUser,
      originCreatedAt: {
        gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
    };
    const users = await this.userRepository.find({where: nonDeletedUser});
    const friendUserIds = users
      .filter(user => approvedFriendIds.includes(user.id))
      .map(e => e.id);
    const publicUserIds = users
      .filter(user => !approvedFriendIds.includes(user.id))
      .map(e => e.id);

    return [
      {
        and: [
          {createdBy: {inq: publicUserIds}},
          {visibility: VisibilityType.PUBLIC},
          {
            originCreatedAt: {
              gte: new Date(
                Date.now() - 365 * 24 * 60 * 60 * 1000,
              ).toISOString(),
            },
          },
        ],
      },
      {
        and: [
          {createdBy: {inq: friendUserIds}},
          {visibility: VisibilityType.FRIEND},
          {
            originCreatedAt: {
              gte: new Date(
                Date.now() - 365 * 24 * 60 * 60 * 1000,
              ).toISOString(),
            },
          },
        ],
      },
    ];
  }

  // ------------------------------------------------

  // ------ ExperienceWhereBuilder ------------------

  private async experienceVisibility(
    visibility?: VisibilityType,
    userId?: string,
  ): Promise<Where<Experience>> {
    const currentUser = this.currentUser?.[securityId];
    const [blockedFriendIds, approvedFriendIds] = await Promise.all([
      this.friendService.getFriendIds(currentUser, FriendStatusType.BLOCKED),
      this.friendService.getFriendIds(currentUser, FriendStatusType.APPROVED),
    ]);

    // Exclude approved friends from blockedFriendIds to get the final userIds
    const userIds = blockedFriendIds.filter(
      id => !approvedFriendIds.includes(id),
    );

    switch (visibility) {
      case VisibilityType.PRIVATE: {
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

        return {
          and: [
            {visibility: VisibilityType.PRIVATE},
            {createdBy: currentUser},
            {createdBy: {nin: userIds}},
            {createdAt: {gte: twelveMonthsAgo.toISOString()}},
          ],
        };
      }

      case VisibilityType.SELECTED: {
        const and: Where<Experience>[] = [
          {visibility: VisibilityType.SELECTED},
          {selectedUserIds: {inq: [currentUser]}} as Where,
          {createdBy: {nin: userIds}},
        ];

        if (userId) {
          and.push({createdBy: userId});
        }

        return {and};
      }

      case VisibilityType.FRIEND: {
        return {
          and: [
            {visibility: VisibilityType.FRIEND},
            {createdBy: {inq: approvedFriendIds}},
            {createdBy: {nin: userIds}},
          ],
        };
      }

      default:
        return {
          and: [
            {visibility: VisibilityType.PUBLIC},
            {createdBy: {nin: userIds}},
          ],
        };
    }
  }

  private async searchExperience(q: string): Promise<Where<Experience>> {
    const userId = this.currentUser?.[securityId];
    const [blockedFriendIds, approvedFriendIds] = await Promise.all([
      this.friendService.getFriendIds(userId, FriendStatusType.BLOCKED),
      this.friendService.getFriendIds(userId, FriendStatusType.APPROVED),
    ]);

    const pattern = new RegExp(q, 'i');
    const userIds = pull([...blockedFriendIds], ...approvedFriendIds);
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    return {
      or: [
        {
          and: [
            {name: {regexp: pattern}},
            {createdBy: {nin: userIds}},
            {visibility: {exists: false}},
            {createdAt: {gte: twelveMonthsAgo.toISOString()}},
          ],
        },
        {
          and: [
            {name: {regexp: pattern}},
            {createdBy: {nin: userIds}},
            {visibility: VisibilityType.PUBLIC},
            {createdAt: {gte: twelveMonthsAgo.toISOString()}},
          ],
        },
        {
          and: [
            {name: {regexp: pattern}},
            {visibility: VisibilityType.FRIEND},
            {createdBy: {inq: [...approvedFriendIds, userId]}},
            {createdAt: {gte: twelveMonthsAgo.toISOString()}},
          ],
        },
        {
          and: [
            {name: {regexp: pattern}},
            {createdBy: userId},
            {createdBy: {nin: blockedFriendIds}},
            {visibility: VisibilityType.PRIVATE},
            {createdAt: {gte: twelveMonthsAgo.toISOString()}},
          ],
        },
        {
          and: [
            {name: {regexp: pattern}},
            {visibility: VisibilityType.SELECTED},
            {
              or: [
                {'selectedUserIds.userId': {inq: [userId]}},
                {createdBy: userId},
              ],
            },
            {
              createdAt: {gte: twelveMonthsAgo.toISOString()},
            } as Where,
          ],
        },
      ],
    };
  }

  // ------------------------------------------------

  private async timelineFilter(
    timelineType?: string,
    query?: Query,
  ): Promise<Where<Post>> {
    // Determine if a date filter is needed based on the query
    const {needsDateFilter} = this.orderSetting(query ?? {});
    let dateFilter: Where<Post> = {};

    if (needsDateFilter) {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
      dateFilter = {originCreatedAt: {gte: twelveMonthsAgo.toISOString()}};
    }

    switch (timelineType) {
      case TimelineType.EXPERIENCE: {
        const experienceId = query?.experienceId;
        const currentUserId = this.currentUser[securityId];
        const timelineConfig = await this.timelineConfigRepository.findOne({
          where: {userId: currentUserId},
        });

        if (!timelineConfig) return {id: ''};

        const timelineFilter: Where<Post>[] = [];
        const timelineConfigData: ConfigData = {};

        if (experienceId) {
          await this.userExperienceRepository.updateAll(
            {
              status: UserExperienceStatus.NONE,
              updatedAt: new Date().toISOString(),
            },
            {
              experienceId: {eq: experienceId as string},
              userId: {eq: currentUserId},
            },
          );

          const config = timelineConfig.data[experienceId.toString()];
          if (config) {
            timelineConfigData[experienceId.toString()] = config;
          }
        } else {
          Object.assign(timelineConfigData, timelineConfig.data);
        }

        const [friendIds, blockedIds] = await Promise.all([
          this.friendService.getFriendIds(
            currentUserId,
            FriendStatusType.APPROVED,
          ),
          this.friendService.getFriendIds(
            currentUserId,
            FriendStatusType.BLOCKED,
          ),
        ]);

        for (const experiencId in timelineConfigData) {
          const config = timelineConfigData[experiencId];
          const filter = await this.timelineVisibilityFilter(
            currentUserId,
            config,
            friendIds,
            blockedIds,
          );
          timelineFilter.push(...filter);
        }

        if (timelineFilter.length === 0) {
          return {id: ''};
        }

        // Combine the timeline filters with the date filter if needed
        const combinedFilter: Where<Post> = needsDateFilter
          ? {
              and: [
                {
                  or: timelineFilter,
                },
                dateFilter,
              ],
            }
          : {
              or: timelineFilter,
            };

        return combinedFilter;
      }

      case TimelineType.TRENDING: {
        // Get the trending timeline filter without passing 'query'
        let trendingFilter = await this.timelineByTrending();

        // Apply the date filter if necessary
        if (needsDateFilter) {
          trendingFilter = {
            and: [trendingFilter, dateFilter],
          };
        }

        return trendingFilter;
      }

      case TimelineType.FRIEND: {
        // Get the friend timeline filter without passing 'query'
        let friendFilter = await this.timelineByFriend();

        // Apply the date filter if necessary
        if (needsDateFilter) {
          friendFilter = {
            and: [friendFilter, dateFilter],
          };
        }

        return friendFilter;
      }

      case TimelineType.ALL: {
        // Get the all timeline filter without passing 'query'
        let allFilter = await this.timelineByAll();

        // Apply the date filter if necessary
        if (needsDateFilter) {
          allFilter = {
            and: [allFilter, dateFilter],
          };
        }

        return allFilter;
      }

      default: {
        if (!query) return this.defaulTimeline();

        let {owner, platform} = query;
        if (Array.isArray(owner)) owner = owner[0];
        if (Array.isArray(platform)) platform = platform[0];

        let defaultOrProfileFilter: Where<Post>;

        if (!owner) {
          defaultOrProfileFilter = await this.defaulTimeline(
            platform?.toString(),
          );
        } else {
          defaultOrProfileFilter = await this.timelineByProfile(
            owner.toString(),
            platform?.toString(),
          );
        }

        // Apply the date filter if necessary
        if (needsDateFilter) {
          defaultOrProfileFilter = {
            and: [defaultOrProfileFilter, dateFilter],
          };
        }

        return defaultOrProfileFilter;
      }
    }
  }

  private async timelineVisibilityFilter(
    currentUserId: string,
    config: Timeline,
    friendIds: string[],
    blockedIds: string[],
  ): Promise<Where<Post>[]> {
    const creator = config.createdBy;
    const visibility = config.visibility;
    const selectedUserIds = config.selectedUserIds ?? [];

    let selected: SelectedUser | undefined = {
      userId: this.currentUser[securityId],
      addedAt: config.createdAt,
    };

    switch (visibility) {
      case VisibilityType.PRIVATE: {
        if (creator !== currentUserId) return [{id: ''}];
        break;
      }

      case VisibilityType.FRIEND: {
        if (creator === currentUserId) break;
        const asFriend = await this.friendService.asFriend(
          creator,
          currentUserId,
        );
        if (asFriend) break;
        return [{id: ''}];
      }

      case VisibilityType.SELECTED: {
        selected = selectedUserIds.find(({userId}) => userId === currentUserId);

        if (selected) break;
        if (creator === currentUserId) break;
        return [{id: ''}];
      }
    }

    return this.timelineByExperience(
      currentUserId,
      config,
      friendIds,
      blockedIds,
      selected,
    );
  }

  private orderSetting(query: Query): {
    order: string[];
    needsDateFilter: boolean;
  } {
    let {sortBy, order} = query;
    let needsDateFilter = false;

    switch (sortBy) {
      case OrderFieldType.POPULAR:
        sortBy = 'popularCount';
        needsDateFilter = true;
        break;

      case OrderFieldType.UPVOTE:
        sortBy = 'metric.upvotes';
        needsDateFilter = true;
        break;

      case OrderFieldType.COMMENT:
        sortBy = 'metric.comments';
        needsDateFilter = true;
        break;

      case OrderFieldType.TIP:
        sortBy = 'metric.tips';
        needsDateFilter = true;
        break;

      case OrderFieldType.LATEST:
        sortBy = 'createdAt';
        break;

      case OrderFieldType.NAME:
        sortBy = 'name';
        break;

      case OrderFieldType.USERNAME:
        sortBy = 'username';
        break;

      default:
        sortBy = 'createdAt';
    }

    if (!order) order = OrderType.DESC;

    const orderArray =
      sortBy === 'createdAt'
        ? [`${sortBy} ${order}`, `originCreatedAt ${order}`]
        : [`${sortBy} ${order}`];

    if (query.name) {
      orderArray.unshift(`friendIndex.${this.currentUser[securityId]} DESC`);
    }

    return {order: orderArray, needsDateFilter};
  }

  private defaultFilter(filter: Filter<AnyObject>) {
    filter.where = {id: generateObjectId()};
  }

  private finalizeFilter(
    filter: Filter<AnyObject>,
    where: Where<AnyObject>,
    additional?: AnyObject,
  ): AnyObject | void {
    filter.where = {...filter.where, ...where};
    return additional;
  }
}

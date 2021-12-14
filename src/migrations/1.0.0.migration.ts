import {AnyObject, repository} from '@loopback/repository';
import {MigrationScript, migrationScript} from 'loopback4-migration';
import {
  ActivityLogRepository,
  FriendRepository,
  LeaderBoardRepository,
  PeopleRepository,
  PostRepository,
  UserRepository,
} from '../repositories';
import {ActivityLog, People, Post} from '../models';
import {
  ActivityLogType,
  FriendStatusType,
  PlatformType,
  ReferenceType,
} from '../enums';
import {inject, service} from '@loopback/core';
import {Twitter, Reddit, FriendService, MetricService} from '../services';
import {BcryptHasher} from '../services/authentication/hash.password.service';
import {config} from '../config';

/* eslint-disable  @typescript-eslint/no-explicit-any */
@migrationScript()
export class MigrationScript100 implements MigrationScript {
  version = '1.0.0';

  constructor(
    @repository(ActivityLogRepository)
    protected activityLogRepository: ActivityLogRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(LeaderBoardRepository)
    protected leaderboardRepository: LeaderBoardRepository,
    @service(FriendService)
    protected friendService: FriendService,
    @service(MetricService)
    protected metricService: MetricService,
    @inject('services.Twitter')
    protected twitterService: Twitter,
    @inject('services.Reddit')
    protected redditService: Reddit,
  ) {}

  async up(): Promise<void> {
    await this.doMigrateActivityLog();
    await this.doMigrateUser();
    await this.doMigratePosts();
    await this.doMigrateFriends();
    // await this.doMigratePeople();
    await this.doRemoveFriends();
    await this.doMigrateWalletAddress();
  }

  async doMigrateUser(): Promise<void> {
    const users = await this.userRepository.find();

    await Promise.all(
      users.map(async user => {
        const {count} = await this.activityLogRepository.count({
          userId: user.id,
          type: {
            nin: [ActivityLogType.CREATEUSERNAME, ActivityLogType.SKIPUSERNAME],
          },
        });

        await this.leaderboardRepository.create({
          userId: user.id,
          totalActivity: count,
        });

        return this.metricService.userMetric(user.id);
      }),
    );
  }

  async doMigrateWalletAddress(): Promise<void> {
    const collection = (
      this.peopleRepository.dataSource.connector as any
    ).collection(People.modelName);

    const people = await collection.aggregate().get();
    const hasher = new BcryptHasher();

    await Promise.all(
      people.map(async (e: AnyObject) => {
        const hashPeopleId = await hasher.hashPassword(
          e._id + config.ESCROW_SECRET_KEY,
        );

        return collection.update(
          {_id: e._id},
          {
            $unset: {
              walletAddress: '',
            },
            $set: {
              walletAddressPassword: hashPeopleId,
            },
          },
        );
      }),
    );
  }

  async doMigrateActivityLog(): Promise<void> {
    const collection = (
      this.activityLogRepository.dataSource.connector as any
    ).collection(ActivityLog.modelName);

    await collection.updateMany(
      {},
      {
        $unset: {
          message: '',
        },
      },
    );
    await collection.deleteMany({type: 'profile'});

    const activityLogs = await this.activityLogRepository.find({
      where: {
        or: [
          {type: ActivityLogType.SKIPUSERNAME},
          {type: ActivityLogType.CREATEUSERNAME},
        ],
      },
    });

    await Promise.all(
      activityLogs.map(e => {
        return this.activityLogRepository.updateById(e.id, {
          referenceId: e.userId,
          referenceType: ReferenceType.USER,
          createdAt: new Date().toString(),
          updatedAt: new Date().toString(),
        });
      }),
    );
  }

  async doRemoveFriends(): Promise<void> {
    const myriadOfficialUserId = this.friendService.myriadOfficialUserId();

    await this.friendRepository.deleteAll({
      or: [
        {requestorId: myriadOfficialUserId},
        {requesteeId: myriadOfficialUserId, status: FriendStatusType.PENDING},
      ],
    });
  }

  async doMigrateFriends(): Promise<void> {
    const friends = await this.friendRepository.find({
      where: {
        status: FriendStatusType.APPROVED,
      },
    });

    await Promise.all(
      friends.map(async friend => {
        const {requesteeId, requestorId} = friend;
        const found = await this.friendRepository.find({
          where: {
            or: [
              {
                requesteeId: requesteeId,
                requestorId: requestorId,
              },
              {
                requesteeId: requestorId,
                requestorId: requesteeId,
              },
            ],
            status: FriendStatusType.APPROVED,
          },
        });

        if (found.length === 1) {
          const {
            requesteeId: currentRequesteeId,
            requestorId: currentRequestorId,
          } = found[0];

          return this.friendRepository.create({
            requestorId: currentRequesteeId,
            requesteeId: currentRequestorId,
            status: FriendStatusType.APPROVED,
          });
        }

        return null;
      }),
    );
  }

  async doMigratePosts(): Promise<void> {
    const collection = (
      this.postRepository.dataSource.connector as any
    ).collection(Post.modelName);

    const posts = await collection.aggregate().get();

    await Promise.all(
      posts.map(async (post: AnyObject) => {
        const originPostId = post.originPostId;
        const platform = post.platform;

        if (platform !== PlatformType.MYRIAD) {
          const {count} = await this.postRepository.count({
            originPostId,
            platform,
          });

          return this.postRepository.updateAll(
            {totalImporter: count},
            {originPostId: originPostId, platform: platform},
          );
        }

        return collection.update(
          {_id: post._id},
          {
            $unset: {
              totalImporter: '',
              importers: '',
            },
          },
        );
      }),
    );
  }

  async doMigratePeople(): Promise<void> {
    const posts = await this.postRepository.find({
      where: {
        or: [
          {
            platform: PlatformType.TWITTER,
          },
          {
            platform: PlatformType.REDDIT,
          },
        ],
      },
      include: ['people'],
    });

    for (const post of posts) {
      if (post.people) continue;

      const originPostId = post.originPostId;
      const platform = post.platform;

      let newPeople = null;

      switch (platform) {
        case PlatformType.REDDIT: {
          newPeople = await this.fetchRedditPost(originPostId ?? '');
          break;
        }

        case PlatformType.TWITTER: {
          newPeople = await this.fetchTweet(originPostId ?? '');
          break;
        }

        default:
          continue;
      }

      if (!newPeople) continue;

      const createdPeople = await this.createOrFindPeople(newPeople);

      await this.postRepository.updateById(post.id, {
        peopleId: createdPeople.id,
      });
    }
  }

  async fetchTweet(originPostId: string): Promise<People | null> {
    if (!originPostId) return null;

    let data = null;

    try {
      data = await this.twitterService.getActions(
        `1.1/statuses/show.json?id=${originPostId}&include_entities=true&tweet_mode=extended`,
      );
    } catch {
      // ignore
    }

    if (!data) return null;

    const {user} = data;

    return new People({
      name: user.name,
      username: user.screen_name,
      originUserId: user.id_str,
      profilePictureURL: user.profile_image_url_https || '',
      platform: PlatformType.TWITTER,
    });
  }

  async fetchRedditPost(originPostId: string): Promise<People | null> {
    if (!originPostId) return null;

    let data = null;

    try {
      [data] = await this.redditService.getActions(originPostId + '.json');
    } catch {
      // ignore
    }

    if (!data) return null;

    const redditPost = data.data.children[0].data;
    const redditUser = redditPost.author;

    let user = null;

    try {
      ({data: user} = await this.redditService.getActions(
        'user/' + redditUser + '/about.json',
      ));
    } catch {
      // ignore
    }

    if (!user) return null;

    return new People({
      name: user.subreddit
        ? user.subreddit.title
          ? user.subreddit.title
          : user.name
        : user.name,
      username: user.name,
      originUserId: 't2_' + user.id,
      profilePictureURL: user.icon_img ? user.icon_img.split('?')[0] : '',
      platform: PlatformType.REDDIT,
    });
  }

  async createOrFindPeople(people: People): Promise<People> {
    let newPeople = await this.peopleRepository.findOne({
      where: {
        originUserId: people.originUserId,
        platform: people.platform,
      },
    });

    if (!newPeople) {
      newPeople = await this.peopleRepository.create(people);

      const hasher = new BcryptHasher();
      const hashPeopleId = await hasher.hashPassword(
        newPeople.id + config.ESCROW_SECRET_KEY,
      );

      await this.peopleRepository.updateById(newPeople.id, {
        walletAddressPassword: hashPeopleId,
      });
    }

    return newPeople;
  }
}

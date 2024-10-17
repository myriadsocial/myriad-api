import {BindingScope, injectable, service} from '@loopback/core';
import {
  AnyObject,
  Count,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {intersection, omit} from 'lodash';
import {
  AccountSettingType,
  ActivityLogType,
  FriendStatusType,
  PlatformType,
  PostStatus,
  ReferenceType,
  VisibilityType,
} from '../enums';
import {
  AccountSetting,
  AddedAt,
  CreateImportedPostDto,
  DraftPost,
  Experience,
  ExperiencePost,
  ExtendedPost,
  Friend,
  People,
  Post,
  PostRelations,
  PostWithRelations,
  User,
} from '../models';
import {
  AccountSettingRepository,
  CommentRepository,
  DraftPostRepository,
  ExperiencePostRepository,
  ExperienceEditorRepository,
  ExperienceRepository,
  FriendRepository,
  PeopleRepository,
  PostRepository,
  TransactionRepository,
  UserRepository,
  UserSocialMediaRepository,
} from '../repositories';
import {formatTag, generateObjectId} from '../utils/formatter';
import {UrlUtils} from '../utils/url-utils';
import {ActivityLogService} from './activity-log.service';
import {MetricService} from './metric.service';
import {NotificationService} from './notification.service';
import {SocialMediaService} from './social-media/social-media.service';
import {TagService} from './tag.service';

const {validateURL, getOpenGraph} = UrlUtils;

@injectable({scope: BindingScope.TRANSIENT})
export class PostService {
  constructor(
    @repository(AccountSettingRepository)
    private accountSettingRepository: AccountSettingRepository,
    @repository(CommentRepository)
    private commentRepository: CommentRepository,
    @repository(DraftPostRepository)
    private draftPostRepository: DraftPostRepository,
    @repository(ExperienceRepository)
    private experienceRepository: ExperienceRepository,
    @repository(ExperiencePostRepository)
    private experiencePostRepository: ExperiencePostRepository,
    @repository(ExperienceEditorRepository)
    private experienceEditorRepository: ExperienceEditorRepository,
    @repository(FriendRepository)
    private friendRepository: FriendRepository,
    @repository(PeopleRepository)
    private peopleRepository: PeopleRepository,
    @repository(PostRepository)
    private postRepository: PostRepository,
    @repository(TransactionRepository)
    private transactionRepository: TransactionRepository,
    @repository(UserRepository)
    private userRepository: UserRepository,
    @repository(UserSocialMediaRepository)
    private userSocialMediaRepository: UserSocialMediaRepository,
    @service(ActivityLogService)
    private activityLogService: ActivityLogService,
    @service(MetricService)
    private metricService: MetricService,
    @service(NotificationService)
    private notificationService: NotificationService,
    @service(SocialMediaService)
    private socialMediaService: SocialMediaService,
    @service(TagService)
    private tagService: TagService,
  ) {}

  // ------------------------------------------------

  // ------ Post ------------------------------------

  public async create(draftPost: DraftPost): Promise<Post | DraftPost> {
    const timelineIds = draftPost.selectedTimelineIds;
    const userId = draftPost.createdBy;
    return this.beforeCreate(draftPost)
      .then(async () => {
        if (draftPost.status === PostStatus.PUBLISHED) {
          if (!draftPost?.text || draftPost?.text?.length <= 3) {
            throw new HttpErrors.UnprocessableEntity(
              'TextAtLeastThreeCharacter',
            );
          }

          const {visibility, selectedUserIds} = await this.getVisibility(
            userId,
            timelineIds,
          );

          const date = Date.now();
          const addedAt: AddedAt = {};
          timelineIds.forEach(e => {
            addedAt[e] = date;
          });

          const rawPost = omit(draftPost, ['status', 'selectedTimelineIds']);
          const newPost = new Post(rawPost);
          newPost.visibility = visibility;
          newPost.selectedUserIds = selectedUserIds;
          newPost.addedAt = addedAt;

          return this.postRepository.create(newPost);
        }

        await this.draftPostRepository.set(draftPost.createdBy, draftPost);
        return draftPost;
      })
      .then(result => {
        if (result.constructor.name === 'DraftPost') return result;
        return this.afterCreate(result as Post, timelineIds);
      })
      .catch(err => {
        throw err;
      });
  }

  public async import(raw: CreateImportedPostDto): Promise<Post> {
    const date = Date.now();
    const platformURL = new UrlUtils(raw.url);
    const pathname = platformURL.getPathname();
    const platform = platformURL.getPlatform();
    const originPostId = platformURL.getOriginPostId();

    Object.assign(raw, {
      url: [platform, originPostId].join(','),
    });

    await this.validateImportedPost(raw);
    const post = await this.fetchImportedPost(raw, pathname);

    const {platformUser} = post;

    if (!platformUser) {
      throw new HttpErrors.UnprocessableEntity('Cannot find specified post');
    }

    if (!platformUser) {
      throw new HttpErrors.NotFound('Platform user not found!');
    }

    const peopleId = generateObjectId();
    const people = await this.peopleRepository
      .findOne({
        where: {
          originUserId: platformUser.originUserId,
          platform: platform,
        },
      })
      .then(found => {
        if (!found) return new People({...platformUser, id: peopleId});
        return found;
      });

    Object.assign(people, {
      name: platformUser.name,
      profilePictureURL: platformUser.profilePictureURL,
    });

    const timelineIds = raw.selectedTimelineIds;
    const rawPost = omit(post, ['platformUser', 'selectedTimelineIds']);

    Promise.allSettled([
      people.id === peopleId
        ? this.peopleRepository.create(people)
        : this.peopleRepository.updateById(people.id, people),
    ]) as Promise<AnyObject>;

    const addedAt: AddedAt = {};

    rawPost.peopleId = people.id;
    raw.selectedTimelineIds.forEach(e => {
      addedAt[e] = date;
    });

    rawPost.addedAt = addedAt;

    return this.postRepository
      .create(rawPost)
      .then(result => this.afterImport(result, people, timelineIds));
  }

  public async draft(userId: string): Promise<DraftPost | null> {
    return this.draftPostRepository.get(userId);
  }

  public async find(
    filter?: Filter<Post>,
    experienceId?: string,
    withImporter = false,
    userId?: string,
  ): Promise<Post[]> {
    const posts = await (experienceId
      ? this.experienceRepository.posts(experienceId).find(filter)
      : this.postRepository.find(filter));

    if (!withImporter) return posts;
    return Promise.all(
      posts.map(async post => {
        return this.postWithImporterInfo(post, userId);
      }),
    );
  }

  public async findById(
    id: string,
    filter = {} as Filter<Post>,
    withImporter = false,
    userId?: string,
    platform?: PlatformType,
  ): Promise<Post> {
    let currentPost: Post & PostRelations;

    if (platform && platform !== PlatformType.MYRIAD) {
      const post = await this.postRepository.findOne({
        where: {
          originPostId: id,
          platform,
        },
      });
      if (!post) {
        throw new HttpErrors.NotFound('PostNotFound');
      }

      currentPost = post;
    } else {
      currentPost = await this.postRepository.findById(id, filter);
    }

    delete currentPost?.user?.email;
    if (!withImporter) return currentPost;
    await this.validateUnrestrictedPost(currentPost, userId);
    return this.postWithImporterInfo(currentPost, userId);
  }

  public async findByProfile(
    id: string,
    filter?: Filter<Post>,
  ): Promise<Post[]> {
    return this.postRepository.find({
      ...filter,
      where: {
        createdBy: id,
      },
    });
  }

  public async updateById(id: string, data: Partial<Post>): Promise<Count> {
    let embeddedURL = null;
    let url = '';

    const updatedAt = new Date().toString();
    const raw: Partial<Post> = new Post({updatedAt});

    if (data.text && data.platform === PlatformType.MYRIAD) {
      const found = data.text.match(/https:\/\/|http:\/\/|www./g);
      if (found) {
        const index: number = data.text.indexOf(found[0]);

        for (let i = index; i < data.text.length; i++) {
          const letter = data.text[i];

          if (letter === ' ' || letter === '"') break;
          url += letter;
        }
      }

      try {
        if (!validateURL(url)) throw new Error('InvalidURL');
        embeddedURL = await getOpenGraph(url);
      } catch (error) {
        embeddedURL = null;
        throw error;
        // ignore
      }

      raw.text = data.text;
      raw.rawText = data.rawText;

      if (embeddedURL) raw.embeddedURL = embeddedURL;
    }

    const visibility = data.visibility;

    if (visibility) {
      raw.visibility = visibility;

      if (visibility !== VisibilityType.SELECTED) {
        raw.selectedUserIds = [];
      }
    }

    if (data.selectedUserIds) raw.selectedUserIds = data.selectedUserIds;
    if (data.mentions) raw.mentions = data.mentions;
    if (data.NSFWTag) raw.NSFWTag = data.NSFWTag;
    if (data.isNSFW) raw.isNSFW = data.isNSFW;
    if (data.tags) raw.tags = data.tags;
    if (data.addedAt) raw.addedAt = data.addedAt;

    if (visibility === VisibilityType.SELECTED) {
      const selectedUserIds = data.selectedUserIds ?? [];
      if (data.createdBy) selectedUserIds.push(data.createdBy);
      raw.selectedUserIds = [...selectedUserIds];
    }

    return this.postRepository.updateAll(raw, {
      createdBy: data.createdBy,
      platform: data.platform,
      id,
    });
  }

  public async deleteById(
    id: string,
    userId: string,
    post?: Post,
  ): Promise<Count> {
    const exclusiveContents = post?.asset?.exclusiveContents ?? [];
    if (exclusiveContents.length > 0) {
      const transactions = await this.transactionRepository.find({
        where: {
          referenceId: {
            inq: exclusiveContents,
          },
          type: ReferenceType.UNLOCKABLECONTENT,
        },
      });

      if (transactions.length > 0) {
        throw new HttpErrors.UnprocessableEntity('ExclusiveContentExists');
      }
    }

    return this.postRepository
      .deleteAll({id, createdBy: userId})
      .then(async count => {
        this.afterDelete(post) as Promise<void>;

        return count;
      });
  }

  public async deleteDraftPostById(id: string): Promise<void> {
    return this.draftPostRepository.delete(id);
  }

  public async count(where?: Where<Post>): Promise<Count> {
    return this.postRepository.count(where);
  }

  public async updatePostDate(id: string, addedAt: AddedAt): Promise<void> {
    return this.postRepository.updateById(id, {
      createdAt: new Date().toString(),
      updatedAt: new Date().toString(),
      addedAt: addedAt,
    });
  }

  // ------------------------------------------------

  // ------ Experience ------------------------------

  public async experiences(
    id: string,
    filter?: Filter<Experience>,
  ): Promise<Experience[]> {
    return this.postRepository.experiences(id).find(filter);
  }

  // ------------------------------------------------

  // ------ PrivateMethod ---------------------------

  private async beforeCreate(draftPost: DraftPost): Promise<void> {
    let url = '';
    const embeddedURL = null;

    if (draftPost.text) {
      const found = draftPost.text.match(
        /https:\/\/(?!storage\.googleapis\.com\/myriad-social-testnet\.appspot\.com)|http:\/\/|www./g,
      );
      if (found) {
        const index: number = draftPost.text.indexOf(found[0]);

        for (let i = index; i < draftPost.text.length; i++) {
          const letter = draftPost.text[i];

          if (letter === ' ' || letter === '"') break;
          url += letter;
        }
      }

      try {
        if (!validateURL(url)) throw new Error('InvalidURL');
        // embeddedURL = await getOpenGraph(url);
      } catch (error) {
        console.error(error);
        // ignore
      }

      if (embeddedURL) {
        draftPost.embeddedURL = embeddedURL;
      }
    }

    if (draftPost.tags && draftPost.tags.length > 0) {
      draftPost.tags = draftPost.tags.map(tag => {
        return formatTag(tag);
      });
    }
  }

  private async afterCreate(post: Post, timelineIds: string[]): Promise<Post> {
    const {id, createdBy: userId, tags, mentions} = post;

    Promise.allSettled([
      this.deleteDraftPostById(userId),
      this.tagService.create(tags),
      this.notificationService.sendMention(id, mentions ?? []),
      this.metricService.userMetric(userId),
      this.metricService.countServerMetric(),
      this.activityLogService.create(
        ActivityLogType.CREATEPOST,
        userId,
        ReferenceType.POST,
      ),
      this.experiencePostRepository.createAll(
        timelineIds.map(e => {
          const experiencePost = new ExperiencePost();
          experiencePost.experienceId = e;
          experiencePost.postId = post.id;
          return experiencePost;
        }),
      ),
    ]) as Promise<AnyObject>;

    return post;
  }

  private async afterImport(
    post: PostWithRelations,
    people: People,
    timelineIds: string[],
  ): Promise<PostWithRelations> {
    const importer = post.createdBy;
    const {id, originPostId, platform, tags, peopleId} = post;
    const [user, userSocialMedia, {count}] = await Promise.all([
      this.userRepository.findOne({where: {id: importer}}),
      this.userSocialMediaRepository.findOne({
        where: {peopleId: peopleId ?? ''},
      }),
      this.count({
        originPostId,
        platform,
        banned: false,
        deletedAt: {exists: false},
      }),
    ]);

    if (post?.people && userSocialMedia) {
      post.people.userSocialMedia = userSocialMedia;
    }

    Promise.allSettled([
      this.tagService.create(tags),
      this.metricService.userMetric(user?.id ?? ''),
      this.metricService.countServerMetric(),
      this.experiencePostRepository.createAll(
        timelineIds.map(e => {
          return {
            postId: post.id,
            experienceId: e,
          };
        }),
      ),
      this.activityLogService.create(
        ActivityLogType.IMPORTPOST,
        id,
        ReferenceType.POST,
      ),
    ]) as Promise<AnyObject>;

    post.importers = user ? [Object.assign(user, {name: 'You'})] : [];
    post.totalImporter = count;
    post.people = people;

    const hiddenFields = [
      'popularCount',
      'rawText',
      'selectedUserIds',
      'addedAt',
    ];
    return omit(post, hiddenFields) as PostWithRelations;
  }

  private async afterDelete(post?: Post): Promise<void> {
    if (!post) return;

    const {id, tags, createdBy} = post;

    Promise.allSettled([
      this.commentRepository.deleteAll({postId: id}),
      this.experiencePostRepository.deleteAll({postId: id}),
      this.metricService.userMetric(createdBy),
      this.metricService.countTags(tags),
      this.metricService.countServerMetric(),
    ]) as Promise<AnyObject>;
  }

  private async postWithImporterInfo(
    post: PostWithRelations,
    userId?: string,
  ): Promise<PostWithRelations> {
    const {count} = await this.experiencePostRepository.count({
      postId: post.id,
      deletedAt: {exists: false},
    });

    post.totalExperience = count;

    if (post.platform === PlatformType.MYRIAD) return post;
    if (!post.user) return post;
    if (!userId) return post;

    const importer = new User({...post.user});
    const {count: totalImporter} = await this.postRepository.count({
      originPostId: post.originPostId,
      platform: post.platform,
      banned: false,
      deletedAt: {exists: false},
    });

    if (userId === post.createdBy) {
      importer.name = 'You';
    }

    post.importers = [importer];
    post.totalImporter = totalImporter;

    const hiddenFields = [
      'popularCount',
      'rawText',
      'selectedUserIds',
      'addedAt',
    ];
    return omit(post, hiddenFields) as PostWithRelations;
  }

  private async validateImportedPost(
    raw: CreateImportedPostDto,
  ): Promise<void> {
    const [platform, originPostId] = raw.url.split(',');
    const importer = raw.importer;

    const posts = await this.postRepository.find({
      where: {
        or: [
          {
            originPostId,
            platform: platform as PlatformType,
          },
          {
            originPostId,
            platform: platform as PlatformType,
            createdBy: importer,
          },
          <AnyObject>{
            originPostId,
            platform: platform as PlatformType,
            deletedAt: {
              $type: ['string', 'date'],
            },
          },
        ],
      },
      limit: 5,
    });

    if (posts.length === 0) return;

    const hasBeenDeleted = posts.find(e => e.deletedAt);

    if (hasBeenDeleted) {
      throw new HttpErrors.NotFound('CannotImportDeletedPost');
    }

    const hasImported = posts.find(e => e.createdBy === importer);

    if (hasImported) {
      throw new HttpErrors.Conflict(`${hasImported.id}`);
    }
  }

  private async validateUnrestrictedPost(
    post: Post,
    currentUserId?: string,
  ): Promise<void> {
    if (post.deletedAt || post.banned)
      throw new HttpErrors.NotFound('Post not found');

    const creator = post.createdBy;
    const visibility = post.visibility;
    const promises: [
      Promise<Friend | null> | null,
      Promise<AccountSetting | null> | null,
    ] = [null, null];

    if (!currentUserId) return;
    if (currentUserId === creator) return;
    if (visibility === VisibilityType.PRIVATE) {
      throw new HttpErrors.Forbidden('PrivatePost');
    } else {
      promises[0] = this.friendRepository.findOne({
        where: {
          or: [
            {
              requestorId: currentUserId,
              requesteeId: creator,
            },
            {
              requesteeId: currentUserId,
              requestorId: creator,
            },
          ],
        },
      });
    }

    if (visibility === VisibilityType.PUBLIC) {
      promises[1] = this.accountSettingRepository.findOne({
        where: {
          userId: creator,
        },
      });
    }

    switch (visibility) {
      case VisibilityType.PUBLIC: {
        const [friend, accountSetting] = await Promise.all(promises);
        if (!accountSetting) return;

        const accountPrivacy = accountSetting.accountPrivacy;

        if (
          accountPrivacy === AccountSettingType.PUBLIC &&
          friend?.status === FriendStatusType.BLOCKED
        ) {
          throw new HttpErrors.Forbidden('PrivatePost');
        }

        if (
          accountPrivacy === AccountSettingType.PRIVATE &&
          friend?.status !== FriendStatusType.APPROVED
        ) {
          throw new HttpErrors.Forbidden('OnlyFriendPost');
        }

        return;
      }

      case VisibilityType.FRIEND: {
        const [friend] = await Promise.all(promises);

        if (friend?.status !== FriendStatusType.APPROVED) {
          throw new HttpErrors.Forbidden('OnlyFriendPost');
        }

        return;
      }

      case VisibilityType.SELECTED: {
        const {selectedUserIds} = post;
        const isSelected = selectedUserIds.find(e => e === currentUserId);
        if (!isSelected) {
          throw new HttpErrors.Forbidden('OnlySelectedUser');
        }
        return;
      }

      default:
        throw new HttpErrors.Forbidden('RestrictedPost');
    }
  }

  private async fetchImportedPost(
    raw: CreateImportedPostDto,
    pathname = '',
  ): Promise<ExtendedPost> {
    const [platform, originPostId] = raw.url.split(',');
    const {visibility, selectedUserIds} = await this.getVisibility(
      raw.importer,
      raw.selectedTimelineIds,
    );

    let rawPost = null;
    switch (platform) {
      case PlatformType.TWITTER:
        rawPost = await this.socialMediaService.fetchTweet(originPostId);
        break;

      case PlatformType.REDDIT:
        rawPost = await this.socialMediaService.fetchRedditPost(
          originPostId,
          pathname,
        );
        break;

      default:
        throw new HttpErrors.BadRequest('Cannot find the platform!');
    }

    if (!rawPost) {
      throw new HttpErrors.BadRequest('Cannot find the specified post');
    }

    rawPost.visibility = visibility;
    rawPost.selectedUserIds = selectedUserIds;
    rawPost.tags = this.getImportedTags(rawPost.tags, raw.tags ?? []);
    rawPost.createdBy = raw.importer;
    rawPost.isNSFW = Boolean(raw.NSFWTag);
    rawPost.NSFWTag = raw.NSFWTag;

    return rawPost;
  }

  private async getVisibility(userId: string, timelineIds = [] as string[]) {
    try {
      const timelineUser = await this.experienceRepository.find({
        where: {
          id: {inq: timelineIds},
          createdBy: userId,
        },
      });
      const editable = await this.experienceEditorRepository
        .find({
          where: {
            experienceId: {inq: timelineIds},
            userId,
          },
        })
        .then(res => {
          const query = res.map(result => result.experienceId);
          return this.experienceRepository.find({
            where: {
              id: {inq: query},
            },
          });
        });
      const timelines = [...timelineUser, ...editable];

      if (timelines.length <= 0) {
        throw new HttpErrors.UnprocessableEntity('TimelineNotFound');
      }

      if (timelines.length !== timelineIds.length) {
        throw new HttpErrors.UnprocessableEntity('TimelineNotMatch');
      }

      const publicTimelines = [];
      const privateTimelines = [];
      const customTimelines = [];
      const friendTimelines = [];

      for (const timeline of timelines) {
        if (timeline.visibility === VisibilityType.PUBLIC) {
          publicTimelines.push(timeline);
        }

        if (timeline.visibility === VisibilityType.FRIEND) {
          friendTimelines.push(timeline);
        }

        if (timeline.visibility === VisibilityType.PRIVATE) {
          privateTimelines.push(timeline);
        }

        if (timeline.visibility === VisibilityType.SELECTED) {
          customTimelines.push(timeline);
        }
      }

      let visibility = VisibilityType.PRIVATE;

      const selectedUserIds = [];

      if (privateTimelines.length <= 0) {
        if (customTimelines.length > 0 || friendTimelines.length > 0) {
          const friends =
            friendTimelines.length === 0
              ? []
              : await this.friendRepository
                  .find({
                    where: {
                      requestorId: userId,
                      status: FriendStatusType.APPROVED,
                    },
                  })
                  .then(result => result.map(e => e.requesteeId));

          const selected = customTimelines.map(e => {
            return e.selectedUserIds.map(selectedUser => {
              if (typeof selectedUser === 'string') return selectedUser;
              return selectedUser.userId;
            });
          });

          const selectedUserIdsIntersection = intersection(...selected);
          selectedUserIds.push(
            ...friends,
            ...selectedUserIdsIntersection,
            userId,
          );
          visibility = VisibilityType.SELECTED;
        } else {
          visibility = VisibilityType.PUBLIC;
        }
      }

      return {
        visibility,
        selectedUserIds,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  private getImportedTags(
    socialTags: string[],
    importedTags: string[],
  ): string[] {
    if (!socialTags) socialTags = [];
    if (!importedTags) importedTags = [];

    const postTags = [...socialTags, ...importedTags]
      .map(tag => formatTag(tag))
      .filter(tag => Boolean(tag));

    return [...new Set(postTags)];
  }
}

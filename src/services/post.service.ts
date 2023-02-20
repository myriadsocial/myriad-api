import {BindingScope, injectable, service} from '@loopback/core';
import {
  AnyObject,
  Count,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {omit} from 'lodash';
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
  CreateImportedPostDto,
  DraftPost,
  Experience,
  ExtendedPost,
  Friend,
  People,
  Post,
  PostWithRelations,
  User,
} from '../models';
import {
  AccountSettingRepository,
  CommentRepository,
  DraftPostRepository,
  ExperiencePostRepository,
  ExperienceRepository,
  FriendRepository,
  PeopleRepository,
  PostRepository,
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
    @repository(FriendRepository)
    private friendRepository: FriendRepository,
    @repository(PeopleRepository)
    private peopleRepository: PeopleRepository,
    @repository(PostRepository)
    private postRepository: PostRepository,
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
    return this.beforeCreate(draftPost)
      .then(async () => {
        if (draftPost.status === PostStatus.PUBLISHED) {
          if (!draftPost?.text || draftPost?.text?.length <= 3) {
            throw new HttpErrors.UnprocessableEntity(
              'TextAtLeastThreeCharacter',
            );
          }

          const rawPost = omit(draftPost, ['status']);
          if (rawPost.visibility === VisibilityType.TIMELINE) {
            let selectedUsers: string[] = [];
            for (const timelineId of rawPost?.selectedTimelineIds ?? []) {
              const experience: Experience =
                await this.experienceRepository.findById(timelineId);
              selectedUsers = [...selectedUsers, ...experience.selectedUserIds];
            }
            rawPost.selectedUserIds = [...new Set(selectedUsers)];
          } else if (rawPost.visibility !== VisibilityType.SELECTED) {
            rawPost.selectedUserIds = [];
          }
          return this.postRepository.create(rawPost);
        }

        await this.draftPostRepository.set(draftPost.createdBy, draftPost);
        return draftPost;
      })
      .then(result => {
        if (result.constructor.name === 'DraftPost') return result;
        return this.afterCreate(new Post(result));
      })
      .catch(err => {
        throw err;
      });
  }

  public async import(raw: CreateImportedPostDto): Promise<Post> {
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

    const rawPost = omit(post, ['platformUser']);

    Promise.allSettled([
      people.id === peopleId
        ? this.peopleRepository.create(people)
        : this.peopleRepository.updateById(people.id, people),
    ]) as Promise<AnyObject>;

    rawPost.peopleId = people.id;

    return this.postRepository
      .create(rawPost)
      .then(result => this.afterImport(result, people));
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
    filter?: Filter<Post>,
    withImporter = false,
    userId?: string,
  ): Promise<Post> {
    const currentPost = await this.postRepository.findById(id, filter);
    if (!withImporter) return currentPost;
    await this.validateUnrestrictedPost(currentPost, userId);
    return this.postWithImporterInfo(currentPost, userId);
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
      } catch {
        // ignore
      }

      raw.text = data.text;
      raw.rawText = data.rawText;

      if (embeddedURL) raw.embeddedURL = embeddedURL;
    }

    if (data.selectedUserIds) raw.selectedUserIds = data.selectedUserIds;
    if (data.visibility !== VisibilityType.SELECTED) raw.selectedUserIds = [];
    if (data.mentions) raw.mentions = data.mentions;
    if (data.NSFWTag) raw.NSFWTag = data.NSFWTag;
    if (data.isNSFW) raw.isNSFW = data.isNSFW;
    if (data.tags) raw.tags = data.tags;

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
    if (exclusiveContents?.length > 0) {
      throw new HttpErrors.UnprocessableEntity('ExclusiveContentExists');
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

  public async updatePostDate(id: string): Promise<void> {
    return this.postRepository.updateById(id, {
      createdAt: new Date().toString(),
      updatedAt: new Date().toString(),
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
    let embeddedURL = null;

    if (draftPost.text) {
      const found = draftPost.text.match(/https:\/\/|http:\/\/|www./g);
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
        embeddedURL = await getOpenGraph(url);
      } catch {
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

  private async afterCreate(post: Post): Promise<Post> {
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
    ]) as Promise<AnyObject>;

    return post;
  }

  private async afterImport(
    post: PostWithRelations,
    people: People,
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
      this.activityLogService.create(
        ActivityLogType.IMPORTPOST,
        id,
        ReferenceType.POST,
      ),
    ]) as Promise<AnyObject>;

    post.importers = user ? [Object.assign(user, {name: 'You'})] : [];
    post.totalImporter = count;
    post.people = people;

    return omit(post);
  }

  private async afterDelete(post?: Post): Promise<void> {
    if (!post) return;

    const {id, tags, createdBy} = post;

    Promise.allSettled([
      this.commentRepository.deleteAll({postId: id}),
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

    return omit(post, ['popularCount', 'rawText']) as PostWithRelations;
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

      case VisibilityType.TIMELINE: {
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

    rawPost.visibility = raw.visibility ?? VisibilityType.PUBLIC;
    rawPost.tags = this.getImportedTags(rawPost.tags, raw.tags ?? []);
    rawPost.createdBy = raw.importer;
    rawPost.isNSFW = Boolean(raw.NSFWTag);
    rawPost.NSFWTag = raw.NSFWTag;

    return rawPost;
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

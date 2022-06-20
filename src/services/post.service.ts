import {AnyObject, repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {ExtendedPost} from '../interfaces';
import {
  AccountSetting,
  defaultPost,
  DraftPost,
  Friend,
  People,
  Post,
  PostWithRelations,
  User,
} from '../models';
import {
  PeopleRepository,
  PostRepository,
  FriendRepository,
  DraftPostRepository,
  AccountSettingRepository,
} from '../repositories';
import {injectable, BindingScope, inject} from '@loopback/core';
import {
  AccountSettingType,
  FriendStatusType,
  PlatformType,
  VisibilityType,
} from '../enums';
import {UrlUtils} from '../utils/url.utils';
import {PlatformPost} from '../models/platform-post.model';
import {AuthenticationBindings} from '@loopback/authentication';
import {UserProfile, securityId} from '@loopback/security';
import {formatTag, generateObjectId} from '../utils/formatted';
import {omit} from 'lodash';

const urlUtils = new UrlUtils();
const {validateURL, getOpenGraph} = urlUtils;

@injectable({scope: BindingScope.TRANSIENT})
export class PostService {
  constructor(
    @repository(PostRepository)
    public postRepository: PostRepository,
    @repository(DraftPostRepository)
    public draftPostRepository: DraftPostRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
    @repository(AccountSettingRepository)
    protected accountSettingRepository: AccountSettingRepository,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    protected currentUser: UserProfile,
  ) {}

  async createPost(post: Omit<ExtendedPost, 'id'>): Promise<PostWithRelations> {
    const {platformUser, platform} = post;

    if (!post) {
      throw new HttpErrors.UnprocessableEntity('Cannot find specified post');
    }

    if (!platformUser) {
      throw new HttpErrors.NotFound('Platform user not found!');
    }

    const peopleId = generateObjectId();
    const people =
      (await this.peopleRepository.findOne({
        where: {
          originUserId: platformUser.originUserId,
          platform: platform,
        },
      })) ?? new People({...platformUser, id: peopleId});

    Object.assign(people, {
      name: platformUser.name,
      profilePictureURL: platformUser.profilePictureURL,
    });

    const postId = generateObjectId();
    const rawPost = defaultPost(omit(post, ['platformUser']));

    Promise.allSettled([
      people.id === peopleId
        ? this.peopleRepository.create(people)
        : this.peopleRepository.updateById(people.id, people),
    ]) as Promise<AnyObject>;

    await this.postRepository.create({
      ...rawPost,
      id: postId,
      peopleId: people.id,
    });

    return Object.assign(rawPost, {id: postId, people: people});
  }

  async getPostImporterInfo(
    post: AnyObject,
    userId?: string,
  ): Promise<AnyObject> {
    if (post.platform === PlatformType.MYRIAD) return omit(post, 'rawText');
    if (!post.user) return post;
    if (!userId) return post;

    const importer = new User({...post.user});
    const {count} = await this.postRepository.count({
      originPostId: post.originPostId,
      platform: post.platform,
      banned: false,
      deletedAt: {exists: false},
    });

    if (userId === post.createdBy) {
      importer.name = 'You';
    }

    return omit({...post, importers: [importer], totalImporter: count}, [
      'rawText',
      'experienceIndex',
    ]);
  }

  async createDraftPost(draftPost: DraftPost): Promise<DraftPost> {
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
        if (url) validateURL(url);
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

    const exist = [false];
    const createDraftPost = await this.draftPostRepository
      .findOne({
        where: {
          createdBy: draftPost.createdBy,
        },
      })
      .then(draft => {
        if (draft) {
          exist[0] = true;
          return draft;
        }
        return this.draftPostRepository.create(draftPost);
      });

    if (exist[0]) {
      this.draftPostRepository.updateById(
        createDraftPost.id,
        draftPost,
      ) as Promise<void>;
    }

    return createDraftPost;
  }

  async createPublishPost(
    postId: string,
    draftPostId: string,
    newPost: Post,
  ): Promise<AnyObject> {
    return Promise.allSettled([
      this.draftPostRepository.deleteById(draftPostId),
      this.postRepository.create({
        ...newPost,
        id: postId,
        platform: PlatformType.MYRIAD,
      }),
    ]);
  }

  async validateImportedPost(platformPost: PlatformPost): Promise<void> {
    const [platform, originPostId] = platformPost.url.split(',');
    const importer = platformPost.importer;

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
              $exists: true,
            },
          },
        ],
      },
      limit: 5,
    });

    if (posts.length === 0) return;

    const hasBeenDeleted = posts.find(e => e.deletedAt);

    if (hasBeenDeleted) {
      throw new HttpErrors.NotFound('You cannot import deleted post');
    }

    const hasImported = posts.find(e => e.createdBy === importer);

    if (hasImported) {
      throw new HttpErrors.Conflict('You have already import this post');
    }
  }

  async validateUnrestrictedPost(post: Post): Promise<void> {
    if (post.deletedAt || post.banned)
      throw new HttpErrors.NotFound('Post not found');

    const creator = post.createdBy;
    const visibility = post.visibility;
    const promises: [
      Promise<Friend | null> | null,
      Promise<AccountSetting | null> | null,
    ] = [null, null];

    if (this.currentUser[securityId] === creator) return;
    if (visibility === VisibilityType.PRIVATE) {
      throw new HttpErrors.Forbidden('Restricted post!');
    } else {
      promises[0] = this.friendRepository.findOne({
        where: {
          or: [
            {
              requestorId: this.currentUser[securityId],
              requesteeId: creator,
            },
            {
              requesteeId: this.currentUser[securityId],
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
          throw new HttpErrors.Forbidden('Restricted post!');
        }

        if (
          accountPrivacy === AccountSettingType.PRIVATE &&
          friend?.status !== FriendStatusType.APPROVED
        ) {
          throw new HttpErrors.Forbidden('Restricted post!');
        }

        return;
      }

      case VisibilityType.FRIEND: {
        const [friend] = await Promise.all(promises);

        if (friend?.status !== FriendStatusType.APPROVED) {
          throw new HttpErrors.Forbidden('Restricted post!');
        }

        return;
      }

      default:
        throw new HttpErrors.Forbidden('Restricted post!');
    }
  }
}

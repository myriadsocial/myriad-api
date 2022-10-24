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
import {omit, pull} from 'lodash';
import {
  AccountSettingType,
  FriendStatusType,
  PlatformType,
  VisibilityType,
} from '../enums';
import {
  CreateExperiencePostDto,
  Experience,
  ExperiencePost,
  ExperienceWithRelations,
  People,
  Post,
} from '../models';
import {
  ExperiencePostRepository,
  ExperienceRepository,
  UserRepository,
} from '../repositories';
import {FriendService} from './friend.service';
import {PostService} from './post.service';

@injectable({scope: BindingScope.TRANSIENT})
export class ExperienceService {
  constructor(
    @repository(ExperienceRepository)
    private experienceRepository: ExperienceRepository,
    @repository(ExperiencePostRepository)
    private experiencePostRepository: ExperiencePostRepository,
    @repository(UserRepository)
    private userRepository: UserRepository,
    @service(FriendService)
    private friendService: FriendService,
    @service(PostService)
    private postService: PostService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private currentUser: UserProfile,
  ) {}

  // ------------------------------------------------

  // ------ Experience ------------------------------

  public async find(filter?: Filter<Experience>): Promise<Experience[]> {
    return this.experienceRepository.find(filter);
  }

  public async findById(
    id: string,
    filter?: Filter<Experience>,
    skip = true,
  ): Promise<ExperienceWithRelations> {
    if (skip) return this.experienceRepository.findById(id, filter);

    filter = filter ?? {};

    const include = [
      {
        relation: 'user',
        scope: {
          include: [{relation: 'accountSetting'}],
        },
      },
      {relation: 'users'},
    ];

    if (!filter.include) filter.include = include;
    else filter.include.push(...include);

    const experience = await this.experienceRepository.findOne(<AnyObject>{
      ...filter,
      where: {
        id,
        deletedAt: {
          $eq: null,
        },
      },
    });

    if (!experience) throw new HttpErrors.NotFound('ExperienceNotFound');

    return this.validatePrivateExperience(experience)
      .then(() => {
        const userToPeople = experience?.users?.map(user => {
          return new People({
            id: user.id,
            name: user.name,
            username: user.username,
            platform: PlatformType.MYRIAD,
            originUserId: user.id,
            profilePictureURL: user.profilePictureURL,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            deletedAt: user.deletedAt,
          });
        });

        if (userToPeople) {
          experience.people = [...experience.people, ...userToPeople];
        }

        return omit(experience, ['users']);
      })
      .catch(err => {
        throw err;
      });
  }

  public async posts(id: string, filter?: Filter<Post>): Promise<Post[]> {
    return this.postService.find(filter, id, true);
  }

  public async addPost(
    data: CreateExperiencePostDto,
  ): Promise<ExperiencePost[]> {
    return this.experiencePostRepository
      .deleteAll({
        experienceId: {inq: data.experienceIds},
        postId: data.postId,
      })
      .then(() => {
        const experiencePosts = data.experienceIds.map(experienceId => {
          return new ExperiencePost({experienceId, postId: data.postId});
        });

        return this.experiencePostRepository.createAll(experiencePosts);
      });
  }

  public async substractPost(
    experienceId: string,
    postId: string,
  ): Promise<Count> {
    return this.experienceRepository
      .findById(experienceId)
      .then(experience => {
        if (experience.createdBy !== this.currentUser[securityId]) {
          return {count: 0};
        }

        return this.experiencePostRepository.deleteAll({postId, experienceId});
      })
      .catch(() => {
        return {count: 0};
      });
  }

  async getExperiencePostId(experienceId?: string): Promise<string[]> {
    if (!experienceId) return [];

    const experiencePosts = await this.experiencePostRepository.find({
      where: {experienceId},
    });
    return experiencePosts.map(e => e.postId?.toString());
  }

  // ------------------------------------------------

  // ------ ExperienceWhereBuilder ------------------

  public async search(where: Where<Experience>, q: string): Promise<void> {
    const userId = this.currentUser?.[securityId];
    const [blockedFriendIds, approvedFriendIds] = await Promise.all([
      this.friendService.getFriendIds(userId, FriendStatusType.BLOCKED),
      this.friendService.getFriendIds(userId, FriendStatusType.APPROVED),
    ]);

    const pattern = new RegExp(q, 'i');
    const userIds = pull(blockedFriendIds, ...approvedFriendIds);

    Object.assign(where, {
      and: [{name: {regexp: pattern}}, {createdBy: {nin: userIds}}],
    });
  }

  public async timeline(
    userId: string,
    experienceId?: string,
  ): Promise<Where<Post>> {
    const exp = await this.fetchExperience(userId, experienceId);

    if (!exp) return {id: ''};

    const postIds = exp.posts?.map(post => post.id) ?? [];
    const userIds: string[] = [];
    const currentUserIds: string[] = [];
    const allowedTags = exp.allowedTags.map(tag => tag.toLowerCase());
    const prohibitedTags = exp.prohibitedTags.map(tag => tag.toLowerCase());
    const personIds = exp.people
      .filter((e: People) => e.platform !== PlatformType.MYRIAD)
      .map(e => e.id);
    const [blockedFriendIds, approvedFriendIds, friends] = await Promise.all([
      this.friendService.getFriendIds(userId, FriendStatusType.BLOCKED),
      this.friendService.getFriendIds(userId, FriendStatusType.APPROVED),
      this.friendService.find({
        where: {
          requestorId: userId,
          requesteeId: {inq: (exp.users ?? []).map(e => e.id)},
          status: FriendStatusType.APPROVED,
        },
      }),
    ]);
    const friendIds = friends.map(friend => friend.requesteeId);
    const blocked = pull(blockedFriendIds, ...friendIds, ...approvedFriendIds);

    if (exp?.users) {
      for (const user of exp.users) {
        const accountPrivacy = user?.accountSetting.accountPrivacy;
        const privateSetting = AccountSettingType.PRIVATE;

        if (accountPrivacy === privateSetting) {
          const found = friendIds.find(id => id === user.id);
          if (found) userIds.push(user.id);
        } else {
          userIds.push(user.id);
        }

        if (user.id === userId) currentUserIds.push(userId);
      }
    }

    return {
      or: [
        {
          and: [
            {tags: {inq: allowedTags}},
            {tags: {nin: prohibitedTags}},
            {createdBy: {nin: blocked}},
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [
            {peopleId: {inq: personIds}},
            {tags: {nin: prohibitedTags}},
            {createdBy: {nin: blocked}},
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [
            {id: {inq: postIds}},
            {createdBy: {nin: blocked}},
            {tags: {nin: prohibitedTags}},
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [
            {id: {inq: postIds}},
            {createdBy: {inq: friendIds}},
            {tags: {nin: prohibitedTags}},
            {visibility: VisibilityType.FRIEND},
          ],
        },
        {
          and: [
            {tags: {inq: allowedTags}},
            {tags: {nin: prohibitedTags}},
            {createdBy: userId},
          ],
        },
        {
          and: [
            {createdBy: {inq: userIds}},
            {tags: {nin: prohibitedTags}},
            {visibility: VisibilityType.PUBLIC},
          ],
        },
        {
          and: [
            {createdBy: {inq: friendIds}},
            {tags: {nin: prohibitedTags}},
            {visibility: VisibilityType.FRIEND},
          ],
        },
        {
          and: [
            {peopleId: {inq: personIds}},
            {tags: {nin: prohibitedTags}},
            {createdBy: userId},
          ],
        },
        {
          and: [
            {tags: {nin: prohibitedTags}},
            {createdBy: {inq: currentUserIds}},
          ],
        },
      ],
    } as Where<Post>;
  }

  // ------------------------------------------------

  // ------ PrivateMethod ---------------------------

  private async fetchExperience(
    userId: string,
    experienceId?: string,
  ): Promise<Experience | null> {
    let experience = null;

    try {
      if (experienceId) {
        experience = await this.experienceRepository.findById(experienceId, {
          include: [
            {
              relation: 'users',
              scope: {
                include: [{relation: 'accountSetting'}],
              },
            },
            {
              relation: 'posts',
            },
          ],
        });
      } else {
        const user = await this.userRepository.findById(userId, {
          include: [
            {
              relation: 'experience',
              scope: {
                include: [
                  {
                    relation: 'users',
                    scope: {
                      include: [{relation: 'accountSetting'}],
                    },
                  },
                  {
                    relation: 'posts',
                  },
                ],
              },
            },
          ],
        });

        if (user.experience) experience = user.experience;
      }
    } catch {
      // ignore
    }

    return experience;
  }

  private async validatePrivateExperience(experience: ExperienceWithRelations) {
    if (!experience?.user?.accountSetting) return;
    if (experience.createdBy === this.currentUser[securityId]) return;
    const {accountPrivacy} = experience.user.accountSetting;
    const friend = await this.friendService.findOne({
      where: {
        or: [
          {
            requestorId: this.currentUser[securityId],
            requesteeId: experience.createdBy,
          },
          {
            requesteeId: this.currentUser[securityId],
            requestorId: experience.createdBy,
          },
        ],
      },
    });
    const isPublic = accountPrivacy === AccountSettingType.PUBLIC;
    const isNotBlocked = friend?.status !== FriendStatusType.BLOCKED;
    const isValid = isPublic && isNotBlocked;
    if (friend?.status === FriendStatusType.APPROVED) return;
    if (isValid) return;
    throw new HttpErrors.Forbidden('PrivateExperience');
  }

  // ------------------------------------------------
}

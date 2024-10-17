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
import {UserExperienceStatus} from '../enums/user-experience-status.enum';
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
  TimelineConfigRepository,
  UserRepository,
  UserExperienceRepository,
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
    @repository(TimelineConfigRepository)
    private timelineConfigRepository: TimelineConfigRepository,
    @repository(UserRepository)
    private userRepository: UserRepository,
    @repository(UserExperienceRepository)
    private userExperienceRepository: UserExperienceRepository,
    @service(FriendService)
    private friendService: FriendService,
    @service(PostService)
    private postService: PostService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private currentUser: UserProfile,
  ) {}

  // ------------------------------------------------

  // ------ Experience ------------------------------

  // count post new per experiences
  public async countNewPost(experienceId: string): Promise<number> {
    const userId = this.currentUser[securityId];

    const lastUpdateUserExperience =
      await this.userExperienceRepository.findOne({
        where: {
          userId: {eq: userId},
          experienceId: {eq: experienceId},
        },
      });

    if (lastUpdateUserExperience) {
      const experiencePost = await this.experiencePostRepository.count({
        experienceId: {eq: experienceId},
        updatedAt: {
          gt: lastUpdateUserExperience.updatedAt,
        },
      });

      return experiencePost.count;
    }

    return 0;
  }

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

    if (experience.createdBy !== this.currentUser[securityId]) {
      if (experience.visibility === VisibilityType.PRIVATE) {
        throw new HttpErrors.Unauthorized('PrivateExperience');
      }

      if (experience.visibility === VisibilityType.SELECTED) {
        const selected = experience.selectedUserIds.find(e => {
          return e.userId === this.currentUser[securityId];
        });
        if (!selected) {
          throw new HttpErrors.Unauthorized('OnlySelectedUser');
        }
      }

      if (experience.visibility === VisibilityType.FRIEND) {
        const asFriend = await this.friendService.asFriend(
          experience.createdBy,
          this.currentUser[securityId],
        );
        if (!asFriend) {
          throw new HttpErrors.Unauthorized('OnlyFriend');
        }
      }
    }

    return this.validatePrivateExperience(experience).then(() => {
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
    });
  }

  public async posts(id: string, filter?: Filter<Post>): Promise<Post[]> {
    await this.userExperienceRepository.updateAll(
      {
        status: UserExperienceStatus.NONE,
        updatedAt: new Date().toString(),
      },
      {
        experienceId: {eq: id},
        userId: {eq: this.currentUser[securityId]},
      },
    );
    const experience = await this.experienceRepository.findById(id);

    if (
      experience?.exclusive === true &&
      this.currentUser[securityId] !== experience.user?.id
    ) {
      return [];
    }

    return this.postService.find(filter, id, true);
  }

  public async addPost(
    data: CreateExperiencePostDto,
  ): Promise<ExperiencePost[]> {
    if (data.experienceIds.length === 0) {
      throw new HttpErrors.UnprocessableEntity('AtLeastOneTimeline');
    }

    const userId = this.currentUser[securityId];

    const [config, post] = await Promise.all([
      this.timelineConfigRepository
        .findOne({
          where: {userId: userId},
        })
        .then(timelineConfig => {
          if (timelineConfig) return timelineConfig;
          return this.timelineConfigRepository.create({
            userId: userId,
          });
        }),
      this.postService.findById(data.postId),
    ]);

    const deletedTimelineIds = [] as string[];

    for (const e of post.experiences ?? []) {
      if (data.experienceIds.includes(e.id)) continue;
      deletedTimelineIds.push(e.id);
      delete post.addedAt[e.id];
      delete config.data[e.id];
    }

    const date = Date.now();
    const newExperiencePosts = [] as ExperiencePost[];

    if (!post.addedAt) post.addedAt = {};

    for (const experienceId of data.experienceIds) {
      if (post.addedAt[experienceId] === undefined) {
        post.addedAt[experienceId] = date;
        const experiencePost = new ExperiencePost();
        experiencePost.experienceId = experienceId;
        experiencePost.postId = data.postId;
        newExperiencePosts.push(experiencePost);
      }
      await this.userExperienceRepository.updateAll(
        {status: UserExperienceStatus.ADDED},
        {
          experienceId: {eq: experienceId},
          userId: {neq: userId},
        },
      );
    }

    if (newExperiencePosts.length <= 0) return [];
    const [experiencePosts] = await Promise.all([
      this.experiencePostRepository.createAll(newExperiencePosts),
      this.postService.updatePostDate(data.postId, post.addedAt),
      this.timelineConfigRepository.update(config),
      this.experiencePostRepository.deleteAll({
        postId: data.postId,
        experienceId: {
          inq: deletedTimelineIds,
        },
      }),
    ]);

    return experiencePosts;
  }

  public async substractPost(
    experienceId: string,
    postId: string,
  ): Promise<Count> {
    const post = await this.postService.findById(postId);

    delete post.addedAt[experienceId];

    return this.experiencePostRepository
      .deleteAll({postId, experienceId})
      .then(count => {
        if (count.count > 0) {
          this.postService.updateById(postId, {
            addedAt: post.addedAt,
          }) as Promise<Count>;
        }

        return count;
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

  public async fetchExperience(
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

  // ------------------------------------------------

  // ------ PrivateMethod ---------------------------

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

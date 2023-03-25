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

  public async findAdvanced(
    filter?: Filter<Experience>,
  ): Promise<Experience[]> {
    const experiences: Experience[] = (await this.experienceRepository.find(
      filter,
    )) as Experience[];

    return experiences.filter(async exp => {
      if (exp.visibility === VisibilityType.PRIVATE) {
        return exp.createdBy === this.currentUser[securityId];
      } else if (exp.visibility === VisibilityType.SELECTED) {
        return exp.selectedUserIds.find(
          e => e.userId === this.currentUser[securityId],
        );
      } else if (exp.visibility === VisibilityType.FRIEND) {
        return this.friendService.asFriend(
          exp.createdBy,
          this.currentUser[securityId],
        );
      } else {
        return true;
      }
    });
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
    return this.postService.find(filter, id, true);
  }

  public async addPost(
    data: CreateExperiencePostDto,
  ): Promise<ExperiencePost[]> {
    if (data.experienceIds.length === 0) {
      throw new HttpErrors.UnprocessableEntity('AtLeastOneTimeline');
    }

    const post = await this.postService.findById(data.postId, {
      include: [
        {
          relation: 'experiences',
          scope: {
            where: {
              createdBy: this.currentUser[securityId],
            },
          },
        },
      ],
    });

    const deletedTimelineIds = [] as string[];

    for (const e of post.experiences ?? []) {
      if (data.experienceIds.includes(e.id)) continue;
      deletedTimelineIds.push(e.id);
      delete post.addedAt[e.id];
    }

    const date = Date.now();
    const newExperiencePosts = [] as ExperiencePost[];

    data.experienceIds.forEach(e => {
      if (post.addedAt[e] === undefined) {
        post.addedAt[e] = date;
        const experiencePost = new ExperiencePost();
        experiencePost.experienceId = e;
        experiencePost.postId = data.postId;
        newExperiencePosts.push(experiencePost);
      }
    });

    if (newExperiencePosts.length <= 0) return [];
    const [experiencePosts] = await Promise.all([
      this.experiencePostRepository.createAll(newExperiencePosts),
      this.postService.updatePostDate(data.postId, post.addedAt),
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
    const post = await this.postService.findById(postId, {
      include: [
        {
          relation: 'experiences',
          scope: {
            where: {
              id: experienceId,
              createdBy: this.currentUser[securityId],
            },
          },
        },
      ],
    });

    if (!post?.experiences) return {count: 0};
    if (post.experiences.length <= 0) return {count: 0};

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

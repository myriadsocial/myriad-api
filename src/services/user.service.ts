import {AuthenticationBindings} from '@loopback/authentication';
import {BindingScope, inject, injectable} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  CommentRepository,
  FriendRepository,
  NotificationRepository,
  PostRepository,
  UserExperienceRepository,
  UserRepository,
  UserSocialMediaRepository,
  VoteRepository,
} from '../repositories';
import {UserProfile, securityId} from '@loopback/security';
import {HttpErrors} from '@loopback/rest';
import {ControllerType, FriendStatusType} from '../enums';
import {config} from '../config';
import {Post} from '../models';

@injectable({scope: BindingScope.TRANSIENT})
export class UserService {
  constructor(
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(NotificationRepository)
    protected notificationRepository: NotificationRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(UserExperienceRepository)
    protected userExperienceRepository: UserExperienceRepository,
    @repository(UserSocialMediaRepository)
    protected userSocialMediaRepository: UserSocialMediaRepository,
    @repository(VoteRepository)
    protected voteRepository: VoteRepository,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    public currentUser: UserProfile,
  ) {}

  async verifyUser(): Promise<void> {
    let error = false;

    if (!this.currentUser) error = true;

    const isUser = await this.userRepository.findOne({
      where: {
        id: this.currentUser[securityId],
        username: this.currentUser.username,
        createdAt: this.currentUser.createdAt,
      },
    });

    if (!isUser) error = true;

    if (error) {
      throw new HttpErrors.Forbidden('Forbidden user!');
    }
  }

  /* eslint-disable  @typescript-eslint/no-explicit-any */
  async authorize(
    controllerName: ControllerType,
    data: any,
    ids = [''],
  ): Promise<Post | void> {
    let error = false;
    let userId = null;
    let additionalData = null;

    switch (controllerName) {
      case ControllerType.COMMENT: {
        if (data) {
          userId = data.userId;
          break;
        }

        ({userId} = await this.commentRepository.findById(ids[0]));
        break;
      }

      case ControllerType.PEOPLE:
      case ControllerType.TAG:
      case ControllerType.CURRENCY:
      case ControllerType.DELETEDCOLLECTION:
      case ControllerType.REPORT:
        userId = config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY;
        break;

      case ControllerType.FRIEND: {
        if (data) {
          userId = data.requestorId;
          break;
        }

        const {requesteeId, requestorId, status} =
          await this.friendRepository.findById(ids[0]);

        if (status === FriendStatusType.APPROVED && !ids[1]) return;

        if (status === FriendStatusType.PENDING) {
          userId = requesteeId;
        }

        if (ids[1] === 'delete') {
          userId = requestorId;
        }

        break;
      }

      case ControllerType.NOTIFICATION: {
        for (const notificationId of ids) {
          ({to: userId} = await this.notificationRepository.findById(
            notificationId,
          ));

          if (userId !== this.currentUser[securityId]) break;
        }

        break;
      }

      case ControllerType.POST: {
        if (data) {
          if (data.importer) {
            userId = data.importer;
          }

          if (data.createdBy) {
            userId = data.createdBy;
          }
          break;
        }

        const post = await this.postRepository.findById(ids[0]);

        userId = post.createdBy;
        additionalData = post;
        break;
      }

      case ControllerType.TRANSACTION:
        userId = data.from;
        break;

      case ControllerType.USERSOCIALMEDIA: {
        if (data) {
          userId = data.publicKey;
          break;
        }

        ({userId} = await this.userSocialMediaRepository.findById(ids[0]));
        break;
      }

      case ControllerType.USEREXPERIENCE: {
        if (data) {
          userId = data;
          break;
        }

        if (ids[0].length === 66) {
          userId = ids[0];
        } else {
          ({userId} = await this.userExperienceRepository.findById(ids[0]));
        }

        break;
      }

      case ControllerType.USERCURRENCY: {
        if (data) {
          userId = data.userId;
          break;
        }

        userId = ids[0];
        break;
      }

      case ControllerType.USERREPORT:
        userId = data;
        break;

      case ControllerType.VOTE: {
        if (data) {
          userId = data.userId;
          break;
        }

        ({userId} = await this.voteRepository.findById(ids[0]));
        break;
      }

      default:
        userId = ids[0];
    }

    if (!userId) error = true;
    if (userId !== this.currentUser[securityId]) error = true;

    if (error) {
      throw new HttpErrors.Unauthorized('Unauthorized user!');
    }

    if (additionalData) return additionalData;
  }
}

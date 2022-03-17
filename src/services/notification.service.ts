import {BindingScope, inject, injectable, service} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {config} from '../config';
import {
  NotificationType,
  PlatformType,
  ReferenceType,
  ReportStatusType,
} from '../enums';
import {
  Comment,
  MentionUser,
  Notification,
  PostWithRelations,
  People,
  Transaction,
  UserSocialMedia,
  Vote,
} from '../models';
import {
  CommentRepository,
  FriendRepository,
  NotificationRepository,
  NotificationSettingRepository,
  PostRepository,
  ReportRepository,
  UserReportRepository,
  UserRepository,
  UserSocialMediaRepository,
  WalletRepository,
} from '../repositories';
import {FCMService} from './fcm.service';
import {UserProfile, securityId} from '@loopback/security';
import {AuthenticationBindings} from '@loopback/authentication';

@injectable({scope: BindingScope.TRANSIENT})
export class NotificationService {
  constructor(
    @repository(UserRepository)
    public userRepository: UserRepository,
    @repository(PostRepository)
    public postRepository: PostRepository,
    @repository(NotificationRepository)
    public notificationRepository: NotificationRepository,
    @repository(UserSocialMediaRepository)
    public userSocialMediaRepository: UserSocialMediaRepository,
    @repository(FriendRepository)
    public friendRepository: FriendRepository,
    @repository(ReportRepository)
    public reportRepository: ReportRepository,
    @repository(CommentRepository)
    public commentRepository: CommentRepository,
    @repository(UserReportRepository)
    public userReportRepository: UserReportRepository,
    @repository(NotificationSettingRepository)
    public notificationSettingRepository: NotificationSettingRepository,
    @repository(WalletRepository)
    public walletRepository: WalletRepository,
    @service(FCMService)
    public fcmService: FCMService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    public currentUser: UserProfile,
  ) {}

  async sendFriendRequest(to: string): Promise<void> {
    const active = await this.checkNotificationSetting(
      to,
      NotificationType.FRIEND_REQUEST,
    );
    if (!active) return;

    const notification = new Notification({
      type: NotificationType.FRIEND_REQUEST,
      from: this.currentUser[securityId],
      referenceId: this.currentUser[securityId],
      message: 'sent you friend request',
    });

    const title = 'Friend Request Accepted';
    const body = this.currentUser.name + ' ' + notification.message;

    await this.sendNotificationToUser(notification, to, title, body);

    return;
  }

  async sendFriendAccept(to: string): Promise<void> {
    const toUser = await this.userRepository.findById(to);

    const notification = new Notification({
      type: NotificationType.FRIEND_ACCEPT,
      from: this.currentUser[securityId],
      referenceId: this.currentUser[securityId],
      message: 'accept your friend request',
    });

    const title = 'Friend Request Accepted';
    const body = this.currentUser.name + ' ' + notification.message;

    await this.sendNotificationToUser(notification, toUser.id, title, body);

    return;
  }

  async cancelFriendRequest(from: string, to: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: {
        type: NotificationType.FRIEND_REQUEST,
        from: from,
        to: to,
        referenceId: from,
      },
    });

    if (notification === null) return;

    await this.notificationRepository.deleteById(notification.id);

    return;
  }

  async sendPostComment(comment: Comment): Promise<void> {
    await this.sendMention(
      comment.id ?? '',
      comment.mentions,
      ReferenceType.COMMENT,
    );

    const additionalReferenceId = {
      comment: {
        id: comment.id,
        postId: comment.postId,
        user: {
          id: this.currentUser[securityId],
          name: this.currentUser.name ?? '',
          username: this.currentUser.username ?? '',
        },
      },
    };

    const notification = new Notification({
      type:
        comment.type === ReferenceType.POST
          ? NotificationType.POST_COMMENT
          : NotificationType.COMMENT_COMMENT,
      from: this.currentUser[securityId],
      referenceId: comment.id,
      message: 'commented: ' + comment.text,
      additionalReferenceId: additionalReferenceId,
    });

    // FCM messages
    const title = 'New Comment';
    const body = `${this.currentUser.name} ${
      comment.type === ReferenceType.COMMENT ? 'reply' : 'commented'
    } your ${comment.type}`;

    let userId = null;

    if (comment.type === ReferenceType.COMMENT) {
      ({userId} = await this.commentRepository.findById(comment.referenceId));
    } else {
      ({createdBy: userId} = await this.postRepository.findById(
        comment.postId,
      ));
    }

    if (userId !== comment.userId) {
      const active = await this.checkNotificationSetting(
        userId,
        notification.type,
      );

      if (active) {
        await this.sendNotificationToUser(notification, userId, title, body);
      }
    }

    return;
  }

  async sendReportResponseToReporters(reportId: string): Promise<void> {
    const {referenceType, referenceId} = await this.reportRepository.findById(
      reportId,
    );
    const reporters = await this.userReportRepository.find({
      where: {reportId: reportId},
    });

    if (reporters.length === 0) return;

    const myriadUserId = await this.getMyriadUserId();
    const notification = new Notification({
      from: myriadUserId,
      message: 'approved your report',
    });

    switch (referenceType) {
      case ReferenceType.USER: {
        notification.type = NotificationType.USER_BANNED;
        notification.referenceId = referenceId;

        const userBanned = await this.userRepository.findById(referenceId, {
          fields: ['id', 'name', 'username'],
        });

        notification.additionalReferenceId = {
          user: userBanned,
        };
        break;
      }

      case ReferenceType.POST: {
        const post = await this.postRepository.findById(referenceId, {
          include: ['user'],
        });

        notification.type = NotificationType.POST_REMOVED;
        notification.referenceId = referenceId;
        notification.additionalReferenceId = {
          post: {
            id: post.id,
            user: {
              id: post.user?.id,
              name: post.user?.name,
              username: post.user?.username,
            },
          },
        };
        break;
      }

      case ReferenceType.COMMENT: {
        const comment = await this.commentRepository.findById(referenceId, {
          include: ['user'],
        });

        notification.type = NotificationType.COMMENT_REMOVED;
        notification.referenceId = referenceId;
        notification.additionalReferenceId = {
          comment: {
            id: comment.id,
            postId: comment.postId,
            user: {
              id: comment.user?.id,
              name: comment.user?.name,
              username: comment.user?.username,
            },
          },
        };
        break;
      }
    }

    const reporterIds = reporters.map(reporter => reporter.reportedBy);
    const title = 'Report Approved';
    const body = 'Myriad Official ' + notification.message;

    await this.sendNotificationToMultipleUsers(
      notification,
      reporterIds,
      title,
      body,
    );

    return;
  }

  async sendReportResponseToUser(reportId: string): Promise<void> {
    const {referenceId, referenceType, status} =
      await this.reportRepository.findById(reportId);

    if (status !== ReportStatusType.REMOVED) return;

    const myriadUserId = await this.getMyriadUserId();
    const notification = new Notification({
      from: myriadUserId,
    });

    switch (referenceType) {
      case ReferenceType.COMMENT: {
        const comment = await this.commentRepository.findById(referenceId, {
          include: ['user'],
        });

        notification.type = NotificationType.COMMENT_REMOVED;
        notification.referenceId = referenceId;
        notification.message = 'removed your comment';
        notification.additionalReferenceId = {
          comment: {
            id: comment.id,
            postId: comment.postId,
            user: {
              id: comment.user?.id,
              name: comment.user?.name,
              username: comment.user?.username,
            },
          },
        };

        await this.sendNotificationToUser(
          notification,
          comment.userId,
          'Comment Removed',
          'Myriad Official ' + notification.message,
        );

        break;
      }

      case ReferenceType.POST: {
        notification.type = NotificationType.POST_REMOVED;
        notification.referenceId = referenceId;
        notification.message = 'removed your post';

        const post = await this.postRepository.findById(referenceId, {
          include: ['user'],
        });
        let posts: PostWithRelations[] = [];

        if (post.url) {
          posts = await this.postRepository.find({
            where: {
              url: post.url,
            },
            include: ['user'],
          });
        } else {
          if (post.platform === PlatformType.MYRIAD) {
            posts = [post];
          } else break;
        }

        await Promise.all(
          posts.map(e => {
            notification.additionalReferenceId = {
              post: {
                id: e.id,
                user: {
                  id: e.user?.id,
                  name: e.user?.name,
                  username: e.user?.username,
                },
              },
            };
            return this.sendNotificationToUser(
              notification,
              e.createdBy,
              'Post Removed',
              'Myriad Official ' + notification.message,
            );
          }),
        );

        break;
      }

      case ReferenceType.USER: {
        notification.type = NotificationType.USER_BANNED;
        notification.referenceId = referenceId;
        notification.message = 'banned you';

        const userBanned = await this.userRepository.findById(referenceId, {
          fields: ['id', 'name', 'username'],
        });

        notification.additionalReferenceId = {
          user: userBanned,
        };

        await this.sendNotificationToUser(
          notification,
          referenceId,
          'User Removed',
          'Myriad Official ' + notification.message,
        );

        break;
      }
    }

    return;
  }

  async sendPostVote(vote: Vote): Promise<void> {
    const notification = new Notification({
      from: this.currentUser[securityId],
      referenceId: vote.id,
      message: vote.state ? 'upvoted' : 'downvoted',
    });

    // FCM messages
    const title = 'New Vote';
    const body = this.currentUser.name + ' ' + notification.message;

    let userId = null;

    // Notification vote to comment
    if (vote.type === ReferenceType.COMMENT) {
      const toComment = await this.commentRepository.findById(
        vote.referenceId,
        {
          include: ['user'],
        },
      );
      notification.type = NotificationType.COMMENT_VOTE;
      notification.additionalReferenceId = {
        comment: {
          id: toComment.id,
          postId: toComment.postId,
          user: {
            id: toComment.user?.id,
            name: toComment.user?.name,
            username: toComment.user?.username,
          },
        },
      };

      userId = toComment.userId;
    } else {
      const toPost = await this.postRepository.findById(vote.referenceId, {
        include: ['user'],
      });
      notification.type = NotificationType.POST_VOTE;
      notification.additionalReferenceId = {
        post: {
          id: toPost.id,
          user: {
            id: toPost.user?.id,
            name: toPost.user?.name,
            username: toPost.user?.username,
          },
        },
      };

      userId = toPost.createdBy;
    }

    if (!userId) return;
    if (userId !== vote.userId) {
      await this.sendNotificationToUser(notification, userId, title, body);
    }

    return;
  }

  async sendMention(
    to: string,
    mentions: MentionUser[],
    type?: ReferenceType,
  ): Promise<void> {
    if (mentions.length === 0) return;
    if (!to) return;

    const notification = new Notification({
      from: this.currentUser[securityId],
      referenceId: to,
      message: 'mentioned you',
    });

    if (type === ReferenceType.COMMENT) {
      const comment = await this.commentRepository.findById(to, {
        include: ['user'],
      });
      notification.type = NotificationType.COMMENT_MENTION;
      notification.additionalReferenceId = {
        comment: {
          id: comment.id,
          postId: comment.postId,
          user: {
            id: comment.user?.id,
            name: comment.user?.name,
            username: comment.user?.username,
          },
        },
      };
    } else {
      const post = await this.postRepository.findById(to, {
        include: ['user'],
      });
      notification.type = NotificationType.POST_MENTION;
      notification.additionalReferenceId = {
        post: {
          id: post.id,
          user: {
            id: post.user?.id,
            name: post.user?.name,
            username: post.user?.username,
          },
        },
      };
    }

    // FCM messages
    const title = 'New Mention';
    const body = this.currentUser.name + ' ' + notification.message;

    const users = mentions.filter(
      mention => mention.id !== this.currentUser[securityId],
    );

    const userIds = [];

    for (const user of users) {
      const mentionActive = await this.checkNotificationSetting(
        user.id,
        notification.type,
      );

      if (mentionActive) userIds.push(user.id);
    }

    await this.sendNotificationToMultipleUsers(
      notification,
      userIds,
      title,
      body,
    );

    return;
  }

  async sendTipsSuccess(transaction: Transaction): Promise<void> {
    const {to, type, referenceId} = transaction;
    const toUser = await this.walletRepository.user(to);

    const tipsActive = await this.checkNotificationSetting(
      toUser.id,
      NotificationType.POST_TIPS,
    );
    if (!tipsActive) return;

    const notification = new Notification({
      from: this.currentUser[securityId],
      referenceId: transaction.id,
      message: transaction.amount + ' ' + transaction.currencyId,
    });

    if (type === ReferenceType.COMMENT && referenceId) {
      const comment = await this.commentRepository.findById(referenceId, {
        include: ['user'],
      });

      notification.type = NotificationType.COMMENT_TIPS;
      notification.additionalReferenceId = {
        comment: {
          id: comment.id,
          postId: comment.postId,
          user: {
            id: comment.user?.id,
            name: comment.user?.name,
            username: comment.user?.username,
          },
        },
      };
    } else if (type === ReferenceType.POST && referenceId) {
      const post = await this.postRepository.findById(referenceId, {
        include: ['user'],
      });

      notification.type = NotificationType.POST_TIPS;
      notification.additionalReferenceId = {
        post: {
          id: post.id,
          user: {
            id: post.user?.id,
            name: post.user?.name,
            username: post.user?.username,
          },
        },
      };
    } else notification.type = NotificationType.USER_TIPS;

    const title = 'Send Tips Success';
    const body = this.currentUser.name + ' ' + notification.message;

    await this.sendNotificationToUser(notification, toUser.id, title, body);

    return;
  }

  async sendRewardSuccess(transaction: Transaction): Promise<void> {
    const {from, to} = transaction;
    const fromUser = await this.walletRepository.user(from);
    const toUser = await this.walletRepository.user(to);

    const tipsActive = await this.checkNotificationSetting(
      toUser.id,
      NotificationType.POST_TIPS,
    );
    if (!tipsActive) return;

    const notification = new Notification({
      type: NotificationType.USER_REWARD,
      from: fromUser.id,
      referenceId: transaction.id,
      message: transaction.amount + ' ' + transaction.currencyId,
    });

    const title = 'Send Reward Success';
    const body = 'Myriad Official' + ' ' + notification.message;

    await this.sendNotificationToUser(notification, toUser.id, title, body);

    return;
  }

  async sendInitialTips(transaction: Transaction): Promise<void> {
    const {from, to} = transaction;
    const fromUser = await this.walletRepository.user(from);
    const toUser = await this.walletRepository.user(to);

    const notification = new Notification({
      type: NotificationType.USER_INITIAL_TIPS,
      from: fromUser.id,
      referenceId: transaction.id,
      message: transaction.amount + ' ' + transaction.currencyId,
    });

    const title = `Send Initial ${transaction.currencyId} Success`;
    const body = 'Myriad Official' + ' ' + notification.message;

    await this.sendNotificationToUser(notification, toUser.id, title, body);

    return;
  }

  async sendClaimTips(transaction: Transaction): Promise<boolean> {
    const {to} = transaction;
    const toUser = await this.walletRepository.user(to);

    const tipsActive = await this.checkNotificationSetting(
      toUser.id,
      NotificationType.POST_TIPS,
    );
    if (!tipsActive) return false;

    const myriadUserId = await this.getMyriadUserId();
    const notification = new Notification({
      type: NotificationType.USER_CLAIM_TIPS,
      from: myriadUserId,
      referenceId: transaction.id,
      message: transaction.amount + ' ' + transaction.currencyId,
    });

    const title = 'Send Claim Tips Success';
    const body = 'You ' + notification.message;

    await this.sendNotificationToUser(notification, toUser.id, title, body);

    return true;
  }

  async sendConnectedSocialMedia(
    userSocialMedia: UserSocialMedia,
    people: People,
  ) {
    const {userId, platform} = userSocialMedia;

    const notification = new Notification({
      type: NotificationType.CONNECTED_SOCIAL_MEDIA,
      from: userId,
      referenceId: userId,
      message: `connected your ${platform} social media`,
      additionalReferenceId: {
        people: {
          id: people.id,
          name: people.name,
          username: people.username,
          platform: people.platform,
        },
      },
    });

    const title = `Connected ${
      platform[0].toUpperCase() + platform.substring(1)
    } Success`;
    const body = 'You ' + notification.message;

    await this.sendNotificationToUser(notification, userId, title, body);

    return true;
  }

  async sendDisconnectedSocialMedia(id: string, fromUserId?: string) {
    const userSocialMedia = await this.userSocialMediaRepository.findById(id, {
      include: ['people'],
    });
    const {userId, platform, people} = userSocialMedia;

    if (!fromUserId) fromUserId = userId;

    const notification = new Notification({
      type: NotificationType.DISCONNECTED_SOCIAL_MEDIA,
      from: fromUserId,
      referenceId: fromUserId,
      message: `disconnected your ${platform} social media`,
      additionalReferenceId: {
        people: {
          id: people?.id,
          name: people?.name,
          username: people?.username,
          platform: people?.platform,
        },
      },
    });

    const title = `Disconnected ${
      platform[0].toUpperCase() + platform.substring(1)
    } Success`;
    const body = 'You ' + notification.message;

    await this.sendNotificationToUser(notification, userId, title, body);

    return true;
  }

  async sendNotificationToUser(
    notification: Notification,
    userId: string,
    title?: string,
    body?: string,
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    const createdNotification = await this.notificationRepository.create({
      ...notification,
      to: user.id,
    });

    if (!createdNotification) return;

    await this.fcmService.sendNotification(
      user.fcmTokens,
      title,
      body,
      createdNotification,
    );
  }

  async sendNotificationToMultipleUsers(
    notification: Notification,
    userIds: string[],
    title?: string,
    body?: string,
  ): Promise<void> {
    if (userIds.length === 0) return;
    const notifications = userIds.map(id => {
      const updatedNotification = {
        ...notification,
        to: id,
      };

      return new Notification(updatedNotification);
    });

    const createdNotifications = await this.notificationRepository.createAll(
      notifications,
    );

    if (!createdNotifications || !createdNotifications.length) return;

    const users = await this.userRepository.find({
      where: {
        or: userIds.map(userId => {
          return {
            id: userId,
          };
        }),
      },
    });

    await Promise.all(
      users.map(user => {
        const found = createdNotifications.find(notif => notif.to === user.id);

        if (found) {
          return this.fcmService.sendNotification(
            user.fcmTokens,
            title,
            body,
            found,
          );
        }

        return;
      }),
    );
  }

  async getCommentAdditionalReferenceIds(
    commentId: string,
  ): Promise<AnyObject[]> {
    if (!commentId) return [];

    const additionalReferenceId = [];
    const flag = true;

    let lastCommentId = commentId;

    while (flag) {
      const lastComment = await this.commentRepository.findById(lastCommentId);

      if (lastComment.type === ReferenceType.POST) {
        additionalReferenceId.unshift({postId: lastComment.postId});
        break;
      } else {
        const comment = await this.commentRepository.findById(
          lastComment.referenceId,
        );
        additionalReferenceId.unshift({commentId: comment.id});

        if (comment.id) lastCommentId = comment.id;
        else break;
      }
    }

    const initialComment = await this.commentRepository.findById(commentId, {
      include: ['user'],
    });

    additionalReferenceId.push({
      commentId,
      user: {
        id: initialComment.user?.id,
        displayName: initialComment.user?.name,
        username: initialComment.user?.username,
      },
    });

    return additionalReferenceId;
  }

  async checkNotificationSetting(
    userId: string,
    type: NotificationType,
  ): Promise<boolean> {
    const notificationSetting =
      await this.notificationSettingRepository.findOne({
        where: {userId: userId},
      });

    if (notificationSetting) {
      switch (type) {
        case NotificationType.FRIEND_REQUEST:
          if (!notificationSetting.friendRequests) return false;
          break;

        case NotificationType.POST_COMMENT:
        case NotificationType.COMMENT_COMMENT:
          if (!notificationSetting.comments) return false;
          break;

        case NotificationType.POST_MENTION:
        case NotificationType.COMMENT_MENTION:
          if (!notificationSetting.mentions) return false;
          break;

        case NotificationType.POST_TIPS:
        case NotificationType.COMMENT_TIPS:
        case NotificationType.USER_TIPS:
          if (!notificationSetting.tips) return false;
          break;

        default:
          return false;
      }
    }

    return true;
  }

  async getMyriadUserId(): Promise<string> {
    const publicAddress = config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY;
    const user = await this.walletRepository.user(publicAddress);
    return user.id;
  }
}

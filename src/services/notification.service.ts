import {BindingScope, inject, injectable, service} from '@loopback/core';
import {AnyObject, repository} from '@loopback/repository';
import {config} from '../config';
import {
  NotificationType,
  PlatformType,
  ReferenceType,
  ReportStatusType,
} from '../enums';
import {ExtendedPeople} from '../interfaces';
import {
  Comment,
  MentionUser,
  Notification,
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
    public userReportReportRepository: UserReportRepository,
    @repository(NotificationSettingRepository)
    public notificationSettingRepository: NotificationSettingRepository,
    @service(FCMService)
    public fcmService: FCMService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    public currentUser: UserProfile,
  ) {}

  async sendFriendRequest(to: string): Promise<boolean> {
    const active = await this.checkNotificationSetting(
      to,
      NotificationType.FRIEND_REQUEST,
    );
    if (!active) return false;

    const notification = new Notification({
      type: NotificationType.FRIEND_REQUEST,
      from: this.currentUser[securityId],
      referenceId: this.currentUser[securityId],
      message: 'sent you friend request',
    });

    const title = 'Friend Request Accepted';
    const body = this.currentUser.name + ' ' + notification.message;

    await this.sendNotificationToUser(notification, to, title, body);

    return true;
  }

  async sendFriendAccept(to: string): Promise<boolean> {
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

    return true;
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

  async sendPostComment(comment: Comment): Promise<boolean> {
    await this.sendMention(
      comment.id ?? '',
      comment.mentions,
      ReferenceType.COMMENT,
    );

    const additionalReferenceId = await this.getCommentAdditionalReferenceIds(
      comment.id ?? '',
    );

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

    const post = await this.postRepository.findById(comment.postId);

    // FCM messages
    const title = 'New Comment';
    const body = this.currentUser.name + ' commented to your post';

    // Notification comment to comment
    if (comment.type === ReferenceType.COMMENT) {
      const toComment = await this.commentRepository.findById(
        comment.referenceId,
      );

      if (toComment.userId !== comment.userId) {
        const commentActive = await this.checkNotificationSetting(
          toComment.userId,
          NotificationType.COMMENT_COMMENT,
        );
        if (commentActive) {
          await this.sendNotificationToUser(
            notification,
            toComment.userId,
            title,
            this.currentUser.name + ' ' + 'reply to your comment',
          );
        }
      }
    }

    // Notification comment to post
    if (post.createdBy === comment.userId) return false;

    const postActive = await this.checkNotificationSetting(
      post.createdBy,
      NotificationType.POST_COMMENT,
    );

    if (!postActive) return postActive;

    await this.sendNotificationToUser(
      notification,
      post.createdBy,
      title,
      body,
    );

    return true;
  }

  async sendReportResponseToReporters(reportId: string): Promise<boolean> {
    const {referenceType, referenceId} = await this.reportRepository.findById(
      reportId,
    );
    const reporters = await this.userReportReportRepository.find({
      where: {reportId: reportId},
    });

    if (reporters.length === 0) return false;

    const notification = new Notification({
      from: config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY,
      message: 'approved your report',
    });

    switch (referenceType) {
      case ReferenceType.USER: {
        notification.type = NotificationType.USER_BANNED;
        notification.referenceId = referenceId;

        const userBanned = await this.userRepository.findById(referenceId, {
          fields: ['id', 'name', 'username'],
        });

        notification.additionalReferenceId = [
          {
            id: userBanned.id,
            displayName: userBanned.name,
            username: userBanned.username,
          },
        ];
        break;
      }

      case ReferenceType.POST: {
        notification.type = NotificationType.POST_REMOVED;
        notification.referenceId = referenceId;
        break;
      }

      case ReferenceType.COMMENT: {
        notification.type = NotificationType.COMMENT_REMOVED;
        notification.referenceId = referenceId;
        notification.additionalReferenceId =
          await this.getCommentAdditionalReferenceIds(referenceId);
        break;
      }

      default:
        return false;
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

    return true;
  }

  async sendReportResponseToUser(reportId: string): Promise<boolean> {
    const {referenceId, referenceType, status} =
      await this.reportRepository.findById(reportId);

    if (status !== ReportStatusType.REMOVED) return false;

    const notification = new Notification({
      from: config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY,
    });

    switch (referenceType) {
      case ReferenceType.COMMENT: {
        notification.type = NotificationType.COMMENT_REMOVED;
        notification.referenceId = referenceId;
        notification.message = 'removed your comment';
        notification.additionalReferenceId =
          await this.getCommentAdditionalReferenceIds(referenceId);

        const comment = await this.commentRepository.findById(referenceId);

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

        const {platform, url, createdBy} = await this.postRepository.findById(
          referenceId,
        );
        const reporteeIds: string[] = [];

        if (url) {
          const posts = await this.postRepository.find({where: {url: url}});
          reporteeIds.push(...posts.map(reportee => reportee.createdBy));
        } else {
          if (platform === PlatformType.MYRIAD) {
            reporteeIds.push(createdBy);
          } else break;
        }

        await this.sendNotificationToMultipleUsers(
          notification,
          reporteeIds,
          'Post Removed',
          'Myriad Official ' + notification.message,
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

        notification.additionalReferenceId = [
          {
            id: userBanned.id,
            displayName: userBanned.name,
            username: userBanned.username,
          },
        ];

        await this.sendNotificationToUser(
          notification,
          referenceId,
          'User Removed',
          'Myriad Official ' + notification.message,
        );

        break;
      }

      default:
        return false;
    }

    return true;
  }

  async sendPostVote(vote: Vote): Promise<boolean> {
    const notification = new Notification({
      type:
        vote.type === ReferenceType.POST
          ? NotificationType.POST_VOTE
          : NotificationType.COMMENT_VOTE,
      from: this.currentUser[securityId],
      referenceId: vote.id,
      message: vote.state ? 'upvoted' : 'downvoted',
    });

    // FCM messages
    const title = 'New Vote';
    const body = this.currentUser.name + ' ' + notification.message;

    // Notification vote to comment
    if (vote.type === ReferenceType.COMMENT) {
      const toComment = await this.commentRepository.findById(vote.referenceId);

      notification.additionalReferenceId =
        await this.getCommentAdditionalReferenceIds(toComment.id ?? '');

      if (toComment.userId !== vote.userId) {
        await this.sendNotificationToUser(
          notification,
          toComment.userId,
          title,
          body,
        );

        return true;
      }

      return false;
    }

    const post = await this.postRepository.findById(vote.postId);

    await this.sendNotificationToUser(
      notification,
      post.createdBy,
      title,
      body,
    );

    return true;
  }

  async sendMention(
    to: string,
    mentions: MentionUser[],
    type?: ReferenceType,
  ): Promise<boolean> {
    if (mentions.length === 0) return false;

    const notification = new Notification({
      type:
        type === ReferenceType.COMMENT
          ? NotificationType.COMMENT_MENTION
          : NotificationType.POST_MENTION,
      from: this.currentUser[securityId],
      referenceId: to,
      message: 'mentioned you',
    });

    if (type === ReferenceType.COMMENT) {
      notification.additionalReferenceId =
        await this.getCommentAdditionalReferenceIds(to);
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
        NotificationType.POST_MENTION,
      );

      if (mentionActive) userIds.push(user.id);
    }

    await this.sendNotificationToMultipleUsers(
      notification,
      userIds,
      title,
      body,
    );

    return true;
  }

  async sendTipsSuccess(transaction: Transaction): Promise<boolean> {
    const {to, type, referenceId} = transaction;

    const tipsActive = await this.checkNotificationSetting(
      to,
      NotificationType.POST_TIPS,
    );
    if (!tipsActive) return false;

    const notification = new Notification({
      from: this.currentUser[securityId],
      referenceId: transaction.id,
      message: transaction.amount + ' ' + transaction.currencyId,
    });

    if (type === ReferenceType.COMMENT && referenceId) {
      notification.type = NotificationType.COMMENT_TIPS;
      notification.additionalReferenceId =
        await this.getCommentAdditionalReferenceIds(referenceId);
    } else if (type === ReferenceType.POST && referenceId) {
      notification.type = NotificationType.POST_TIPS;
      notification.additionalReferenceId = [{postId: referenceId}];
    } else notification.type = NotificationType.USER_TIPS;

    const title = 'Send Tips Success';
    const body = this.currentUser.name + ' ' + notification.message;

    await this.sendNotificationToUser(notification, to, title, body);

    return true;
  }

  async sendRewardSuccess(transaction: Transaction): Promise<boolean> {
    const {from, to} = transaction;

    const notification = new Notification({
      type: NotificationType.USER_REWARD,
      from: from,
      referenceId: transaction.id,
      message: transaction.amount + ' ' + transaction.currencyId,
    });

    const title = 'Send Reward Success';
    const body = 'Myriad Official' + ' ' + notification.message;

    await this.sendNotificationToUser(notification, to, title, body);

    return true;
  }

  async sendInitialTips(transaction: Transaction): Promise<boolean> {
    const {from, to} = transaction;

    const notification = new Notification({
      type: NotificationType.USER_INITIAL_TIPS,
      from: from,
      referenceId: transaction.id,
      message: transaction.amount + ' ' + transaction.currencyId,
    });

    const title = `Send Initial ${transaction.currencyId} Success`;
    const body = 'Myriad Official' + ' ' + notification.message;

    await this.sendNotificationToUser(notification, to, title, body);

    return true;
  }

  async sendClaimTips(transaction: Transaction): Promise<boolean> {
    const {to} = transaction;

    const tipsActive = await this.checkNotificationSetting(
      to,
      NotificationType.POST_TIPS,
    );
    if (!tipsActive) return false;

    const notification = new Notification({
      type: NotificationType.USER_CLAIM_TIPS,
      from: config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY,
      referenceId: transaction.id,
      message: transaction.amount + ' ' + transaction.currencyId,
    });

    const title = 'Send Claim Tips Success';
    const body = 'You ' + notification.message;

    await this.sendNotificationToUser(notification, to, title, body);

    return true;
  }

  async sendConnectedSocialMedia(
    userSocialMedia: UserSocialMedia,
    people: ExtendedPeople,
  ) {
    const {userId, platform, peopleId} = userSocialMedia;
    const {name, username} = people;

    const notification = new Notification({
      type: NotificationType.CONNECTED_SOCIAL_MEDIA,
      from: userId,
      referenceId: userId,
      message: `connected your ${platform} social media`,
      additionalReferenceId: [
        {
          peopleId: peopleId,
          peopleName: name,
          peopleUsername: username,
          peoplePlatform: platform,
        },
      ],
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
    const {userId, platform, peopleId, people} = userSocialMedia;

    if (!fromUserId) fromUserId = userId;

    const notification = new Notification({
      type: NotificationType.DISCONNECTED_SOCIAL_MEDIA,
      from: fromUserId,
      referenceId: fromUserId,
      message: `disconnected your ${platform} social media`,
      additionalReferenceId: [
        {
          peopleId: peopleId,
          peopleName: people?.name,
          peopleUsername: people?.username,
          peoplePlatform: people?.platform,
        },
      ],
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
}

import {BindingScope, injectable, service} from '@loopback/core';
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
  Transaction,
  User,
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
import {PolkadotJs} from '../utils/polkadotJs-utils';
import {FCMService} from './fcm.service';

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
  ) {}

  async sendFriendRequest(from: string, to: string): Promise<boolean> {
    const notificationSetting =
      await this.notificationSettingRepository.findOne({
        where: {userId: to},
      });

    if (notificationSetting && !notificationSetting.friendRequests)
      return false;

    const fromUser = await this.userRepository.findById(from);
    const toUser = await this.userRepository.findById(to);

    const notification = new Notification();
    notification.type = NotificationType.FRIEND_REQUEST;
    notification.from = fromUser.id;
    notification.to = toUser.id;
    notification.referenceId = fromUser.id;
    notification.message = 'sent you friend request';

    const createdNotification = await this.notificationRepository.create(
      notification,
    );
    if (createdNotification === null) return false;

    const title = 'Friend Request Accepted';
    const body = fromUser.name + ' ' + notification.message;
    await this.fcmService.sendNotification(
      toUser.fcmTokens,
      title,
      body,
      createdNotification,
    );

    return true;
  }

  async sendFriendAccept(fromUser: User, toUser: User): Promise<boolean> {
    if (!fromUser || !toUser) return false;

    const notification = new Notification();
    notification.type = NotificationType.FRIEND_ACCEPT;
    notification.from = fromUser.id;
    notification.to = toUser.id;
    notification.referenceId = fromUser.id;
    notification.message = 'accept your friend request';

    const createdNotification = await this.notificationRepository.create(
      notification,
    );
    if (createdNotification === null) return false;

    const title = 'Friend Request Accepted';
    const body = fromUser.name + ' ' + notification.message;
    await this.fcmService.sendNotification(
      toUser.fcmTokens,
      title,
      body,
      createdNotification,
    );

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

  async sendPostComment(from: string, comment: Comment): Promise<boolean> {
    await this.sendMention(
      from,
      comment.id ?? '',
      comment.mentions,
      ReferenceType.COMMENT,
    );

    const fromUser = await this.userRepository.findById(from);
    const notification = new Notification();

    notification.type =
      comment.type === ReferenceType.POST
        ? NotificationType.POST_COMMENT
        : NotificationType.COMMENT_COMMENT;
    notification.from = fromUser.id;
    notification.referenceId = comment.id;
    notification.message = 'commented: ' + comment.text;

    // FCM messages
    const title = 'New Comment';
    const body = fromUser.name + ' ' + notification.message;

    let toUser: User = new User();

    const post = await this.postRepository.findById(comment.postId);

    notification.additionalReferenceId =
      await this.getCommentAdditionalReferenceIds(comment.id ?? '');

    // Notification comment to comment
    if (comment.type === ReferenceType.COMMENT) {
      const toComment = await this.commentRepository.findById(
        comment.referenceId,
      );

      if (toComment.userId !== comment.userId) {
        const notificationSetting =
          await this.notificationSettingRepository.findOne({
            where: {userId: toComment.userId},
          });

        // TODO: fixed notification setting
        if (notificationSetting && !notificationSetting.comments) return false;

        toUser = await this.userRepository.findById(toComment.userId);
        notification.to = toUser.id;

        const createdNotification = await this.notificationRepository.create(
          notification,
        );
        await this.fcmService.sendNotification(
          toUser.fcmTokens,
          title,
          body,
          createdNotification,
        );
      }
    }

    // Notification comment to post
    let toUsers: string[] = [];
    if (post.platform === PlatformType.MYRIAD) {
      toUser = await this.userRepository.findById(post.createdBy);

      if (toUser.id === comment.userId) return false;

      toUsers.push(toUser.id);
    } else {
      const userSocialMedia = await this.userSocialMediaRepository.findOne({
        where: {peopleId: post.peopleId},
      });

      if (userSocialMedia) {
        toUser = await this.userRepository.findById(userSocialMedia.userId);
        toUsers.push(toUser.id);
      }

      toUsers = [...toUsers, ...post.importers].filter(
        userId => userId !== comment.userId,
      );
    }

    if (toUsers.length === 0) return false;
    if (!toUser) return false;

    const notificationSetting =
      await this.notificationSettingRepository.findOne({
        where: {userId: toUser.id},
      });

    if (notificationSetting && !notificationSetting.comments) {
      toUsers = toUsers.filter(userId => userId !== toUser.id);
    }

    const notifications = toUsers.map(to => {
      const updatedNotification = {
        ...notification,
        to: to,
      };

      return new Notification(updatedNotification);
    });

    const createdNotifications = await this.notificationRepository.createAll(
      notifications,
    );
    if (createdNotifications.length === 0) return false;

    const users = await this.userRepository.find({
      where: {
        or: toUsers.map(userId => {
          return {
            id: userId,
          };
        }),
      },
    });

    await Promise.all(
      users.map(to => {
        const found = createdNotifications.find(notif => notif.to === to.id);

        if (found) {
          return this.fcmService.sendNotification(
            to.fcmTokens,
            title,
            body,
            found,
          );
        }

        return;
      }),
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

    const notification = new Notification();

    const {getKeyring, getHexPublicKey} = new PolkadotJs();

    const mnemonic = config.MYRIAD_MNEMONIC;
    const pair = getKeyring().addFromMnemonic(mnemonic);

    notification.from = getHexPublicKey(pair);
    notification.message = 'approved your report';

    switch (referenceType) {
      case ReferenceType.USER: {
        notification.type = NotificationType.USER_BANNED;
        notification.referenceId = referenceId;
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

    const notifications = reporters.map(reporter => {
      const updatedNotification = {
        ...notification,
        to: reporter.reportedBy,
      };

      return new Notification(updatedNotification);
    });

    const createdNotifications = await this.notificationRepository.createAll(
      notifications,
    );
    if (createdNotifications.length === 0) return false;

    const users = await this.userRepository.find({
      where: {
        or: reporters.map(reporter => {
          return {
            id: reporter.reportedBy,
          };
        }),
      },
    });

    await Promise.all(
      users.map(to => {
        const found = createdNotifications.find(notif => notif.to === to.id);

        if (found) {
          return this.fcmService.sendNotification(
            to.fcmTokens,
            'Report Approved',
            'Myriad Official ' + notification.message,
            found,
          );
        }

        return;
      }),
    );

    return true;
  }

  async sendReportResponseToUser(reportId: string): Promise<boolean> {
    const {referenceId, referenceType, status} =
      await this.reportRepository.findById(reportId);

    if (status !== ReportStatusType.REMOVED) return false;

    const {getKeyring, getHexPublicKey} = new PolkadotJs();

    const mnemonic = config.MYRIAD_MNEMONIC;
    const pair = getKeyring().addFromMnemonic(mnemonic);

    const notification = new Notification();

    notification.from = getHexPublicKey(pair);

    switch (referenceType) {
      case ReferenceType.COMMENT: {
        notification.type = NotificationType.COMMENT_REMOVED;
        notification.referenceId = referenceId;
        notification.additionalReferenceId =
          await this.getCommentAdditionalReferenceIds(referenceId);

        const comment = await this.commentRepository.findById(referenceId);

        notification.to = comment.userId;
        notification.message = 'removed your comment';

        const commentUser = await this.userRepository.findById(comment.userId);

        const createdNotification = await this.notificationRepository.create(
          notification,
        );
        await this.fcmService.sendNotification(
          commentUser.fcmTokens,
          'Comment Removed',
          'Myriad Official ' + notification.message,
          createdNotification,
        );

        break;
      }

      case ReferenceType.POST: {
        notification.type = NotificationType.POST_REMOVED;
        notification.referenceId = referenceId;
        notification.message = 'removed your post';

        const post = await this.postRepository.findById(referenceId);

        let toUsers: string[] = [];
        let toUser: User = new User();

        if (post.platform === PlatformType.MYRIAD) {
          toUser = await this.userRepository.findById(post.createdBy);
          toUsers.push(toUser.id);
        } else {
          const userSocialMedia = await this.userSocialMediaRepository.findOne({
            where: {peopleId: post.peopleId},
          });

          if (userSocialMedia) {
            toUser = await this.userRepository.findById(userSocialMedia.userId);
            toUsers.push(toUser.id);
          }

          toUsers = [...toUsers, ...post.importers, post.createdBy];
        }

        if (toUsers.length === 0) return false;
        if (!toUser) return false;

        const notifications = toUsers.map(to => {
          const updatedNotification = {
            ...notification,
            to: to,
          };

          return new Notification(updatedNotification);
        });

        const createdNotifications =
          await this.notificationRepository.createAll(notifications);
        if (createdNotifications.length === 0) return false;

        const users = await this.userRepository.find({
          where: {
            or: toUsers.map(userId => {
              return {
                id: userId,
              };
            }),
          },
        });

        await Promise.all(
          users.map(to => {
            const found = createdNotifications.find(
              notif => notif.to === to.id,
            );

            if (found) {
              return this.fcmService.sendNotification(
                to.fcmTokens,
                'Post Removed',
                'Myriad Official ' + notification.message,
                found,
              );
            }

            return;
          }),
        );

        break;
      }

      case ReferenceType.USER: {
        notification.type = NotificationType.USER_BANNED;
        notification.referenceId = referenceId;
        notification.message = 'banned you';
        notification.to = referenceId;

        const user = await this.userRepository.findById(referenceId);

        const createdNotification = await this.notificationRepository.create(
          notification,
        );
        await this.fcmService.sendNotification(
          user.fcmTokens,
          'User Removed',
          'Myriad Official ' + notification.message,
          createdNotification,
        );
        break;
      }

      default:
        return false;
    }

    return true;
  }

  async sendPostVote(from: string, vote: Vote): Promise<boolean> {
    const fromUser = await this.userRepository.findById(from);
    const notification = new Notification();

    notification.type =
      vote.type === ReferenceType.POST
        ? NotificationType.POST_VOTE
        : NotificationType.COMMENT_VOTE;
    notification.from = fromUser.id;
    notification.referenceId = vote.id;
    notification.message = vote.state ? 'upvoted' : 'downvoted';

    // FCM messages
    const title = 'New Vote';
    const body = fromUser.name + ' ' + notification.message;

    let toUser = null;

    // Notification vote to comment
    if (vote.type === ReferenceType.COMMENT) {
      const toComment = await this.commentRepository.findById(vote.referenceId);

      toUser = await this.userRepository.findById(toComment.userId);
      notification.to = toUser.id;
      notification.additionalReferenceId =
        await this.getCommentAdditionalReferenceIds(toComment.id ?? '');

      const createdNotification = await this.notificationRepository.create(
        notification,
      );

      await this.fcmService.sendNotification(
        toUser.fcmTokens,
        title,
        body,
        createdNotification,
      );

      return true;
    }

    const post = await this.postRepository.findById(vote.postId);

    // Notification vote to post
    let toUsers: string[] = [];

    if (post.platform === PlatformType.MYRIAD) {
      toUser = await this.userRepository.findById(post.createdBy);
      toUsers.push(toUser.id);
    } else {
      const userSocialMedia = await this.userSocialMediaRepository.findOne({
        where: {peopleId: post.peopleId},
      });

      if (userSocialMedia) {
        toUser = await this.userRepository.findById(userSocialMedia.userId);
        toUsers.push(toUser.id);
      }

      toUsers = [...toUsers, ...post.importers, post.createdBy];
    }

    if (toUsers.length === 0) return false;

    const notifications = toUsers.map(to => {
      const updatedNotification = {
        ...notification,
        to: to,
      };

      return new Notification(updatedNotification);
    });

    const createdNotifications = await this.notificationRepository.createAll(
      notifications,
    );
    if (createdNotifications.length === 0) return false;

    const users = await this.userRepository.find({
      where: {
        or: toUsers.map(userId => {
          return {
            id: userId,
          };
        }),
      },
    });

    await Promise.all(
      users.map(to => {
        const found = createdNotifications.find(notif => notif.to === to.id);

        if (found) {
          return this.fcmService.sendNotification(
            to.fcmTokens,
            title,
            body,
            found,
          );
        }
      }),
    );

    return true;
  }

  async sendMention(
    from: string,
    to: string,
    mentions: MentionUser[],
    type?: ReferenceType,
  ): Promise<boolean> {
    if (mentions.length === 0) return false;

    const fromUser = await this.userRepository.findById(from);
    const notification = new Notification();
    notification.type =
      type === ReferenceType.COMMENT
        ? NotificationType.COMMENT_MENTION
        : NotificationType.POST_MENTION;
    notification.from = fromUser.id;
    notification.referenceId = to;
    notification.message = 'mentioned you';

    if (type === ReferenceType.COMMENT) {
      notification.additionalReferenceId =
        await this.getCommentAdditionalReferenceIds(to);
    }

    // FCM messages
    const title = 'New Mention';
    const body = fromUser.name + ' ' + notification.message;

    const toUsers = await this.userRepository.find({
      where: {
        or: mentions
          .filter(mention => mention.id !== from)
          .map(mention => {
            return {
              id: mention.id,
            };
          }),
      },
    });

    if (toUsers.length === 0) return false;

    const notifications = toUsers
      .filter(async user => {
        const notificationSetting =
          await this.notificationSettingRepository.findOne({
            where: {
              userId: user.id,
            },
          });

        if (notificationSetting && !notificationSetting.mentions) return false;
        return true;
      })
      .map(toUser => {
        const updatedNotification = {
          ...notification,
          to: toUser.id,
        };

        return new Notification(updatedNotification);
      });

    const createdNotifications = await this.notificationRepository.createAll(
      notifications,
    );
    if (createdNotifications.length === 0) return false;

    await Promise.all(
      toUsers.map(toUser => {
        const found = createdNotifications.find(
          notif => notif.to === toUser.id,
        );

        if (found) {
          return this.fcmService.sendNotification(
            toUser.fcmTokens,
            title,
            body,
            found,
          );
        }

        return;
      }),
    );

    return true;
  }

  async sendTipsSuccess(transaction: Transaction): Promise<boolean> {
    const {from, to, type, referenceId} = transaction;
    const fromUser = await this.userRepository.findById(from);
    const toUser = await this.userRepository.findById(to);

    const notificationSetting =
      await this.notificationSettingRepository.findOne({
        where: {
          userId: toUser.id,
        },
      });

    if (notificationSetting && !notificationSetting.tips) return false;

    const notification = new Notification();

    if (type === ReferenceType.COMMENT && referenceId) {
      notification.type = NotificationType.COMMENT_TIPS;
      notification.additionalReferenceId =
        await this.getCommentAdditionalReferenceIds(referenceId);
    } else if (type === ReferenceType.POST && referenceId) {
      notification.type = NotificationType.POST_TIPS;
      notification.additionalReferenceId = [{postId: referenceId}];
    } else notification.type = NotificationType.USER_TIPS;

    notification.from = fromUser.id;
    notification.to = toUser.id;
    notification.referenceId = transaction.id;
    notification.message = transaction.amount + ' ' + transaction.currencyId;

    const createdNotification = await this.notificationRepository.create(
      notification,
    );
    if (createdNotification == null) return false;

    const title = 'Send Tips Success';
    const body = fromUser.name + ' ' + notification.message;

    await this.fcmService.sendNotification(
      toUser.fcmTokens,
      title,
      body,
      createdNotification,
    );

    return true;
  }

  async sendRewardSuccess(transaction: Transaction): Promise<boolean> {
    const {from, to} = transaction;
    const notification = new Notification();
    const toUser = await this.userRepository.findById(to);

    notification.type = NotificationType.USER_REWARD;
    notification.from = from;
    notification.to = to;
    notification.referenceId = transaction.id;
    notification.message = transaction.amount + ' ' + transaction.currencyId;

    const createdNotification = await this.notificationRepository.create(
      notification,
    );
    if (createdNotification == null) return false;

    const title = 'Send Reward Success';
    const body = 'Myriad Official' + ' ' + notification.message;

    await this.fcmService.sendNotification(
      toUser.fcmTokens,
      title,
      body,
      createdNotification,
    );

    return true;
  }

  async sendIntitalAUSD(transaction: Transaction): Promise<boolean> {
    const {from, to} = transaction;
    const notification = new Notification();
    const toUser = await this.userRepository.findById(to);

    notification.type = NotificationType.USER_INITIAL_TIPS;
    notification.from = from;
    notification.to = to;
    notification.referenceId = transaction.id;
    notification.message = transaction.amount + ' ' + transaction.currencyId;

    const createdNotification = await this.notificationRepository.create(
      notification,
    );
    if (createdNotification == null) return false;

    const title = 'Send Initial AUSD Success';
    const body = 'Myriad Official' + ' ' + notification.message;

    await this.fcmService.sendNotification(
      toUser.fcmTokens,
      title,
      body,
      createdNotification,
    );

    return true;
  }

  async sendClaimTips(transaction: Transaction): Promise<boolean> {
    const {from, to} = transaction;

    const notification = new Notification();
    const toUser = await this.userRepository.findById(to);

    const notificationSetting =
      await this.notificationSettingRepository.findOne({
        where: {
          userId: toUser.id,
        },
      });

    if (notificationSetting && !notificationSetting.tips) return false;

    const {getKeyring, getHexPublicKey} = new PolkadotJs();

    const mnemonic = config.MYRIAD_MNEMONIC;
    const pair = getKeyring().addFromMnemonic(mnemonic);

    notification.type = NotificationType.USER_CLAIM_TIPS;
    notification.from = from;
    notification.to = getHexPublicKey(pair);
    notification.referenceId = transaction.id;
    notification.message = transaction.amount + ' ' + transaction.currencyId;

    const createdNotification = await this.notificationRepository.create(
      notification,
    );
    if (createdNotification == null) return false;

    const title = 'Send Claim Tips Success';
    const body = 'You ' + notification.message;

    await this.fcmService.sendNotification(
      toUser.fcmTokens,
      title,
      body,
      createdNotification,
    );
    return true;
  }

  async sendConnectedSocialMedia(userSocialMedia: UserSocialMedia) {
    const {userId, platform, peopleId} = userSocialMedia;
    const notification = new Notification();
    const toUser = await this.userRepository.findById(userId);

    notification.type = NotificationType.CONNECTED_SOCIAL_MEDIA;
    notification.from = toUser.id;
    notification.to = toUser.id;
    notification.referenceId = toUser.id;
    notification.message = `connected your ${platform} social media`;
    notification.additionalReferenceId = [{peopleId: peopleId}];

    const createdNotification = await this.notificationRepository.create(
      notification,
    );

    if (createdNotification === null) return false;

    const title = `Connected ${
      platform[0].toUpperCase() + platform.substring(1)
    } Success`;
    const body = 'You ' + notification.message;

    await this.fcmService.sendNotification(
      toUser.fcmTokens,
      title,
      body,
      createdNotification,
    );

    return true;
  }

  async sendDisconnectedSocialMedia(id: string, fromUserId?: string) {
    const userSocialMedia = await this.userSocialMediaRepository.findById(id);
    const {userId, platform, peopleId} = userSocialMedia;
    const notification = new Notification();
    const toUser = await this.userRepository.findById(userId);

    if (!fromUserId) fromUserId = toUser.id;
    else await this.userRepository.findById(fromUserId);

    notification.type = NotificationType.DISCONNECTED_SOCIAL_MEDIA;
    notification.from = fromUserId;
    notification.to = toUser.id;
    notification.referenceId = fromUserId;
    notification.message = `disconnected your ${platform} social media`;
    notification.additionalReferenceId = [{peopleId: peopleId}];

    const createdNotification = await this.notificationRepository.create(
      notification,
    );

    if (createdNotification === null) return false;

    const title = `Disconnected ${
      platform[0].toUpperCase() + platform.substring(1)
    } Success`;
    const body = 'You ' + notification.message;

    await this.fcmService.sendNotification(
      toUser.fcmTokens,
      title,
      body,
      createdNotification,
    );

    return true;
  }

  async getCommentAdditionalReferenceIds(
    commentId: string,
  ): Promise<AnyObject[]> {
    const lastCommentId = commentId;

    let additionalReferenceId = [];
    let firstCommentId = null;
    let secondCommentId = null;

    let lastComment = await this.commentRepository.findById(lastCommentId);

    if (lastComment.type === ReferenceType.POST) {
      additionalReferenceId = [{postId: lastComment.postId}];
    } else {
      lastComment = await this.commentRepository.findById(
        lastComment.referenceId,
      );

      firstCommentId = lastComment.id;
      secondCommentId = lastComment.id;

      if (lastComment.type === ReferenceType.POST) {
        additionalReferenceId = [
          {postId: lastComment.postId},
          {firstCommentId: firstCommentId},
        ];
      } else {
        lastComment = await this.commentRepository.findById(
          lastComment.referenceId,
        );
        firstCommentId = lastComment.id;

        additionalReferenceId = [
          {postId: lastComment.postId},
          {firstCommentId: firstCommentId},
          {secondCommentId: secondCommentId},
        ];
      }
    }

    return additionalReferenceId;
  }

  async readNotification(to?: string): Promise<void> {
    if (!to) return;

    try {
      const user = await this.userRepository.findById(to);

      await this.notificationRepository.updateAll({read: true}, {to: user.id});
    } catch (err) {
      // ignore
    }

    return;
  }
}

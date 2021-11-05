import {BindingScope, injectable, service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {NotificationType, PlatformType, ReferenceType} from '../enums';
import {
  Comment,
  MentionUser,
  Notification,
  Transaction,
  User,
  Vote,
} from '../models';
import {
  CommentRepository,
  FriendRepository,
  NotificationRepository,
  PostRepository,
  ReportRepository,
  UserRepository,
  UserSocialMediaRepository,
} from '../repositories';
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
    @service(FCMService)
    public fcmService: FCMService,
  ) {}

  async sendFriendRequest(from: string, to: string): Promise<boolean> {
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
    if (createdNotification == null) return false;

    const title = 'Friend Request Accepted';
    const body = fromUser.name + ' ' + notification.message;
    await this.fcmService.sendNotification(toUser.fcmTokens, title, body);

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
    if (createdNotification == null) return false;

    const title = 'Friend Request Accepted';
    const body = fromUser.name + ' ' + notification.message;
    await this.fcmService.sendNotification(toUser.fcmTokens, title, body);

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

    if (notification == null) return;

    await this.notificationRepository.deleteById(notification.id);

    return;
  }

  async sendPostComment(from: string, comment: Comment): Promise<boolean> {
    const fromUser = await this.userRepository.findById(from);
    const notification = new Notification();

    notification.type =
      comment.type === ReferenceType.POST
        ? NotificationType.POST_COMMENT
        : NotificationType.COMMENT_COMMENT;
    notification.from = fromUser.id;
    notification.referenceId = comment.id;
    notification.message = 'commented: ' + comment.text;

    if (comment.type === ReferenceType.COMMENT) {
      const lastCommentId = comment.id;

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

      notification.additionalReferenceId = additionalReferenceId;
    }

    // FCM messages
    const title = 'New Comment';
    const body = fromUser.name + ' ' + notification.message;

    let toUser = null;

    // Notification comment to comment
    if (comment.type === ReferenceType.COMMENT) {
      const toComment = await this.commentRepository.findById(
        comment.referenceId,
      );
      toUser = await this.userRepository.findById(toComment.userId);
      notification.to = toUser.id;

      await this.notificationRepository.create(notification);
      await this.fcmService.sendNotification(toUser.fcmTokens, title, body);

      return true;
    }

    const post = await this.postRepository.findById(comment.postId);

    // Notification comment to post
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

    const createdNotification = await this.notificationRepository.createAll(
      notifications,
    );
    if (createdNotification == null) return false;

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
        return this.fcmService.sendNotification(to.fcmTokens, title, body);
      }),
    );

    return true;
  }

  async sendReport(
    from: string,
    to: string,
    referenceType: ReferenceType,
  ): Promise<boolean> {
    let toUser = null;
    let notificationType = null;
    let message = null;

    const fromUser = await this.userRepository.findById(from);

    if (referenceType === ReferenceType.USER) {
      toUser = await this.userRepository.findById(to);
      notificationType = NotificationType.REPORT_USER;
      message = 'reported you';
    } else if (ReferenceType.POST) {
      const post = await this.postRepository.findById(to);

      toUser = await this.userRepository.findById(post.createdBy);
      notificationType = NotificationType.REPORT_POST;
      message = 'reported your post';
    } else return false;

    const notification = new Notification();
    notification.type = notificationType;
    notification.from = fromUser.id;
    notification.to = toUser.id;
    notification.referenceId = to;
    notification.message = message;

    await this.notificationRepository.create(notification);

    const title = 'New Report';
    const body = 'another user' + ' ' + notification.message;
    await this.fcmService.sendNotification(toUser.fcmTokens, title, body);

    return true;
  }

  async sendUpdateReport(
    referenceId: string,
    type: ReferenceType,
  ): Promise<boolean> {
    const report = await this.reportRepository.findOne({
      where: {
        referenceId,
        referenceType: type,
      },
    });

    if (!report) return false;

    const {referenceId: to, referenceType} = report;

    let toUser = null;
    let notificationType = null;
    let message = null;

    if (referenceType === ReferenceType.USER) {
      toUser = await this.userRepository.findById(to);
      notificationType = NotificationType.REPORT_USER;
      message = 'your account has been suspended';
    } else if (ReferenceType.POST) {
      const post = await this.postRepository.findById(to);
      toUser = await this.userRepository.findById(post.createdBy);
      notificationType = NotificationType.REPORT_POST;
      message = 'your post has been deleted';
    } else return false;

    const notification = new Notification();
    notification.type = notificationType;
    notification.to = toUser.id;
    notification.referenceId = to;
    notification.message = message;

    await this.notificationRepository.create(notification);

    const title = 'New Report';
    const body = notification.message;
    await this.fcmService.sendNotification(toUser.fcmTokens, title, body);

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
      await this.fcmService.sendNotification(toUser.fcmTokens, title, body);

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
    if (createdNotifications === null) return false;

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
        return this.fcmService.sendNotification(to.fcmTokens, title, body);
      }),
    );

    return true;
  }

  async sendMention(
    from: string,
    to: string,
    mentions: MentionUser[],
  ): Promise<boolean> {
    if (mentions.length === 0) return false;

    const fromUser = await this.userRepository.findById(from);
    const notification = new Notification();
    notification.type = NotificationType.POST_MENTION;
    notification.from = fromUser.id;
    notification.referenceId = to;
    notification.message = 'mentioned you';

    // FCM messages
    const title = 'New Mention';
    const body = fromUser.name + ' ' + notification.message;
    const toUsers = await this.userRepository.find({
      where: {
        or: mentions.map(mention => {
          return {
            id: mention.id,
          };
        }),
      },
    });

    if (toUsers.length === 0) return false;

    const notifications = toUsers.map(toUser => {
      const updatedNotification = {
        ...notification,
        to: toUser.id,
      };

      return new Notification(updatedNotification);
    });

    const createdNotification = await this.notificationRepository.createAll(
      notifications,
    );
    if (createdNotification == null) return false;

    await Promise.all(
      toUsers.map(toUser => {
        return this.fcmService.sendNotification(toUser.fcmTokens, title, body);
      }),
    );

    return true;
  }

  async sendTipsSuccess(transaction: Transaction): Promise<boolean> {
    const {from, to, type, referenceId} = transaction;
    const fromUser = await this.userRepository.findById(from);
    const toUser = await this.userRepository.findById(to);

    const notification = new Notification();

    if (type === ReferenceType.COMMENT && referenceId) {
      notification.type = NotificationType.COMMENT_TIPS;

      const lastCommentId = referenceId;

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
      notification.additionalReferenceId = additionalReferenceId;
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

    await this.fcmService.sendNotification(toUser.fcmTokens, title, body);

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
    const body = 'Myriad' + ' ' + notification.message;

    await this.fcmService.sendNotification(toUser.fcmTokens, title, body);

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
    const body = 'Myriad' + ' ' + notification.message;

    await this.fcmService.sendNotification(toUser.fcmTokens, title, body);

    return true;
  }

  async sendClaimTips(transaction: Transaction): Promise<boolean> {
    const {from, to} = transaction;

    const notification = new Notification();
    const toUser = await this.userRepository.findById(to);

    notification.type = NotificationType.USER_CLAIM_TIPS;
    notification.from = from;
    notification.to = to;
    notification.referenceId = transaction.id;
    notification.message = transaction.amount + ' ' + transaction.currencyId;

    const createdNotification = await this.notificationRepository.create(
      notification,
    );
    if (createdNotification == null) return false;

    const title = 'Send Claim Tips Success';
    const body = 'You ' + notification.message;

    await this.fcmService.sendNotification(toUser.fcmTokens, title, body);
    return true;
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

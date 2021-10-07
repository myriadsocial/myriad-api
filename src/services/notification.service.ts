import {BindingScope, injectable, service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {NotificationType, PlatformType, ReferenceType} from '../enums';
import {Comment, Notification} from '../models';
import {
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
    @service(FCMService)
    public fcmService: FCMService,
  ) {}

  async sendFriendRequest(from: string, to: string): Promise<boolean> {
    const fromUser = await this.userRepository.findById(from);
    if (fromUser == null) return false;
    const toUser = await this.userRepository.findById(to);
    if (toUser == null) return false;

    const notification = new Notification();
    notification.type = NotificationType.FRIEND_REQUEST;
    notification.from = fromUser.id;
    notification.to = toUser.id;
    notification.referenceId = toUser.id;
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

  async sendFriendAccept(friendId: string): Promise<boolean> {
    const {requestee: fromUser, requestor: toUser} =
      await this.friendRepository.findById(friendId, {
        include: ['requestee', 'requestor'],
      });

    if (!fromUser || !toUser) return false;

    const notification = new Notification();
    notification.type = NotificationType.FRIEND_ACCEPT;
    notification.from = fromUser.id;
    notification.to = toUser.id;
    notification.referenceId = toUser.id;
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
        referenceId: to,
      },
    });

    if (notification == null) return;

    await this.notificationRepository.deleteById(notification.id);

    return;
  }

  async sendPostComment(from: string, comment: Comment): Promise<boolean> {
    const fromUser = await this.userRepository.findById(from);
    if (fromUser == null) return false;
    const post = await this.postRepository.findById(comment.postId);

    let toUser = null;
    if (post.platform === PlatformType.MYRIAD) {
      toUser = await this.userRepository.findById(post.createdBy);
    } else {
      const userSocialMedia = await this.userSocialMediaRepository.findOne({
        where: {peopleId: post.peopleId},
      });

      if (!userSocialMedia) return false;
      toUser = await this.userRepository.findById(userSocialMedia.userId);
    }

    if (toUser == null) return false;

    const notification = new Notification();
    notification.type = NotificationType.POST_COMMENT;
    notification.from = fromUser.id;
    notification.to = toUser.id;
    notification.referenceId = comment.id;
    notification.message = 'commented: ' + comment.text;

    const createdNotification = await this.notificationRepository.create(
      notification,
    );
    if (createdNotification == null) return false;

    const title = 'New Comment';
    const body = fromUser.name + ' ' + notification.message;
    await this.fcmService.sendNotification(toUser.fcmTokens, title, body);

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

    const {reportedBy: from, referenceId: to, referenceType} = report;
    const fromUser = await this.userRepository.findById(from);

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
    notification.from = fromUser.id;
    notification.to = toUser.id;
    notification.referenceId = to;
    notification.message = message;

    await this.notificationRepository.create(notification);

    const title = 'New Report';
    const body = notification.message;
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

import {BindingScope, injectable, service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {NotificationType, PlatformType} from '../enums';
import {Comment, Notification} from '../models';
import {
  NotificationRepository,
  PostRepository,
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

  async sendFriendAccept(from: string, to: string): Promise<boolean> {
    const fromUser = await this.userRepository.findById(from);
    if (fromUser == null) return false;
    const toUser = await this.userRepository.findById(to);
    if (toUser == null) return false;

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

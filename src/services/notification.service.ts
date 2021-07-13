import {BindingScope, injectable, service} from '@loopback/core';
import {repository} from '@loopback/repository';
import {NotificationType} from '../enums';
import {Notification} from '../models';
import {NotificationRepository, UserRepository} from '../repositories';
import { FCMService } from './fcm.service';

@injectable({scope: BindingScope.TRANSIENT})
export class NotificationService {
  constructor(
    @repository(UserRepository)
    public userRepository: UserRepository,
    @repository(NotificationRepository)
    public notificationRepository: NotificationRepository,
    @service(FCMService)
    public fcmService: FCMService,
  ) { }

  async sendFriendRequest(from: string, to: string): Promise<boolean> {
    const fromUser = await this.userRepository.findById(from);
    if (fromUser == null) return false
    const toUser = await this.userRepository.findById(to);
    if (toUser == null) return false

    const notification = new Notification()
    notification.type = NotificationType.FRIEND_REQUEST
    notification.from = fromUser.id
    notification.to = toUser.id
    notification.message = fromUser.name + ' sent you friend request'
    notification.createdAt = new Date().toString()

    const createdNotification = await this.notificationRepository.create(notification)
    if (createdNotification == null) return false

    await this.fcmService.sendNotification(toUser.fcmTokens, 'Friend Request', notification.message)
    return true
  }

  async sendFriendAccept(from: string, to: string): Promise<boolean> {
    const fromUser = await this.userRepository.findById(from);
    if (fromUser == null) return false
    const toUser = await this.userRepository.findById(to);
    if (toUser == null) return false

    const notification = new Notification()
    notification.type = NotificationType.FRIEND_ACCEPT
    notification.from = fromUser.id
    notification.to = toUser.id
    notification.message = fromUser.name + ' accept your friend request'
    notification.createdAt = new Date().toString()

    const createdNotification = await this.notificationRepository.create(notification)
    if (createdNotification == null) return false

    await this.fcmService.sendNotification(toUser.fcmTokens, 'Friend Request Accepted', notification.message)
    return true
  }
}

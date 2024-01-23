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
import {capitalize} from 'lodash';
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
  Report,
  Transaction,
  UserSocialMediaWithRelations,
  Vote,
} from '../models';
import {
  ExperienceRepository,
  CommentRepository,
  CurrencyRepository,
  NotificationRepository,
  NotificationSettingRepository,
  PostRepository,
  ReportRepository,
  UserReportRepository,
  UserRepository,
  UserSocialMediaRepository,
} from '../repositories';
import {FCMService} from './fcm.service';
import {AdditionalData} from './transaction.service';

@injectable({scope: BindingScope.TRANSIENT})
export class NotificationService {
  constructor(
    @repository(ExperienceRepository)
    private experienceRepository: ExperienceRepository,
    @repository(UserRepository)
    private userRepository: UserRepository,
    @repository(PostRepository)
    private postRepository: PostRepository,
    @repository(NotificationRepository)
    private notificationRepository: NotificationRepository,
    @repository(UserSocialMediaRepository)
    private userSocialMediaRepository: UserSocialMediaRepository,
    @repository(ReportRepository)
    private reportRepository: ReportRepository,
    @repository(CommentRepository)
    private commentRepository: CommentRepository,
    @repository(UserReportRepository)
    private userReportRepository: UserReportRepository,
    @repository(NotificationSettingRepository)
    private notificationSettingRepository: NotificationSettingRepository,
    @repository(CurrencyRepository)
    private currencyRepository: CurrencyRepository,
    @service(FCMService)
    private fcmService: FCMService,
    @inject(AuthenticationBindings.CURRENT_USER, {optional: true})
    private currentUser: UserProfile,
  ) {}

  public async find(filter?: Filter<Notification>): Promise<Notification[]> {
    return this.notificationRepository.find(filter);
  }

  public async count(where?: Where<Notification>): Promise<Count> {
    return this.notificationRepository.count(where);
  }

  public async read(id?: string): Promise<Count> {
    const where = {
      to: this.currentUser[securityId],
      read: false,
    };

    if (id) Object.assign(where, {id});

    return this.notificationRepository.updateAll(
      {read: true, updatedAt: new Date().toString()},
      where,
    );
  }

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
      message: 'sent you a friend request',
    });

    const title = 'New Friend Request';
    const body = `${this.currentUser.name} ${notification.message}`;

    await this.sendNotificationToUser(notification, to, title, body);

    return;
  }

  async sendFriendAccept(to: string): Promise<void> {
    const toUser = await this.userRepository.findById(to);

    const notification = new Notification({
      type: NotificationType.FRIEND_ACCEPT,
      from: this.currentUser[securityId],
      referenceId: this.currentUser[securityId],
      message: 'accepted your friend request',
    });

    const title = 'New Friend Request';
    const body = `${this.currentUser.name} ${notification.message}`;

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

  async sendVoteCount(
    referencetype: ReferenceType,
    referenceID: string,
    upvotes: number,
  ): Promise<void> {
    const destination: string = await (referencetype === ReferenceType.POST
      ? this.postRepository
          .findById(referenceID, {
            fields: ['createdBy'],
          })
          .then(result => result.createdBy)
      : this.commentRepository
          .findById(referenceID, {
            fields: ['userId'],
          })
          .then(result => result.userId));

    const MyriadUserID = await this.getMyriadUserId();
    const notification = new Notification({
      type: NotificationType.VOTE_COUNT,
      referenceId: referenceID,
      message: upvotes.toString(),
      from: MyriadUserID,
    });
    const title = 'New Upvotes';
    const body = 'Your post is getting upvotes';
    await this.sendNotificationToUser(
      notification,
      destination,
      title,
      body,
    ).catch((err: Error) => {
      throw err;
    });
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
        section: comment.section,
        user: {
          id: this.currentUser[securityId],
          name: this.currentUser.name ?? '',
          username: this.currentUser.username ?? '',
        },
      },
    };

    const notificationMessage = (text: string) => {
      const message = JSON.parse(text);
      return message[0].children.text
        ? message[0].children.text
        : ('' as string);
    };

    const notification = new Notification({
      type:
        comment.type === ReferenceType.POST
          ? NotificationType.POST_COMMENT
          : NotificationType.COMMENT_COMMENT,
      from: this.currentUser[securityId],
      referenceId: comment.id,
      message: notificationMessage(comment.text),
      additionalReferenceId: additionalReferenceId,
    });

    // FCM messages
    const title = 'New Comment';
    const body = `${this.currentUser.name} ${
      comment.type === ReferenceType.COMMENT ? 'replied to' : 'commented to'
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

  async sendReport(report: Report): Promise<void> {
    const [fromUser, toUser] = await Promise.all([
      this.userRepository.findById(this.currentUser[securityId]),
      this.userRepository.findById(report?.reportedDetail?.user?.id ?? ''),
    ]);

    let notificationType = null;
    let message = null;

    switch (report.referenceType) {
      case ReferenceType.USER:
        notificationType = NotificationType.REPORT_USER;
        message = `${toUser.name} was reported by ${fromUser.name}`;
        break;

      case ReferenceType.POST:
        notificationType = NotificationType.REPORT_POST;
        message = `${toUser.name}'s post was reported by ${fromUser.name}`;
        break;

      case ReferenceType.COMMENT:
        notificationType = NotificationType.REPORT_COMMENT;
        message = `${toUser.name}'s comment was reported by ${fromUser.name}`;
        break;

      default:
        return;
    }

    const notification = new Notification({
      type: notificationType,
      from: fromUser.id,
      to: toUser.id,
      referenceId: report.id,
      message,
    });

    await this.notificationRepository.create(notification);
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
    const body = `Myriad Official ${notification.message}`;

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
          `Myriad Official ${notification.message}`,
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
              `Myriad Official ${notification.message}`,
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
          `Myriad Official ${notification.message}`,
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
          section: toComment.section,
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
          section: comment.section,
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
    const body = `${this.currentUser.name} ${notification.message}`;

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

  async sendSubscriberCount(
    referenceID: string,
    followers: number,
  ): Promise<void> {
    const userId: string = await this.experienceRepository
      .findById(referenceID, {
        fields: ['createdBy'],
      })
      .then(result => result.createdBy);
    const myriadUserId = await this.getMyriadUserId();
    const notification = new Notification({
      type: NotificationType.FOLLOWER_COUNT,
      referenceId: referenceID,
      message: followers.toString(),
      from: myriadUserId,
    });
    const body = 'Your timeline is getting follower';
    const title = 'Follower Notification';

    await this.sendNotificationToUser(notification, userId, title, body);
  }

  async sendTipsSuccess(
    transaction: Transaction,
    additional: AdditionalData,
  ): Promise<void> {
    const {to: toUserId, type, referenceId} = transaction;
    const {toWalletId: toWallet, contentReferenceId} = additional;
    const tipsActive = await this.checkNotificationSetting(
      toUserId,
      NotificationType.POST_TIPS,
    );
    if (!tipsActive) return;

    const symbol = await this.getCurrencySymbol(transaction.currencyId);
    const notification = new Notification({
      from: this.currentUser[securityId],
      referenceId: transaction.id,
      message: transaction.amount + ' ' + symbol,
    });

    if (type === ReferenceType.UNLOCKABLECONTENT && referenceId) {
      let isContentExists = true;

      const additionalReferenceId: AnyObject = {};
      const comment = await this.commentRepository.findOne(<AnyObject>{
        where: {
          id: contentReferenceId,
          'asset.exclusiveContents': {
            like: `${referenceId}.*`,
            options: 'i',
          },
        },
      });

      if (!comment) {
        const post = await this.postRepository.findOne(<AnyObject>{
          where: {
            id: contentReferenceId,
            'asset.exclusiveContents': {
              like: `${referenceId}.*`,
              options: 'i',
            },
          },
        });

        if (post) {
          Object.assign(additionalReferenceId, {
            unlockableContent: {
              id: referenceId,
              post: {
                id: post.id,
              },
            },
          });
        } else {
          isContentExists = false;
        }
      } else {
        Object.assign(additionalReferenceId, {
          unlockableContent: {
            id: referenceId,
            comment: {
              id: comment.id,
              postId: comment.postId,
              section: comment.section,
            },
          },
        });
      }

      if (!isContentExists) throw new HttpErrors.NotFound('ContentNotFound');

      notification.type = NotificationType.PAID_CONTENT;
      notification.additionalReferenceId = additionalReferenceId;
    } else if (type === ReferenceType.COMMENT && referenceId) {
      const comment = await this.commentRepository.findById(referenceId, {
        include: ['user'],
      });

      notification.type = toWallet
        ? NotificationType.COMMENT_TIPS
        : NotificationType.COMMENT_TIPS_UNCLAIMED;

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

      notification.type = toWallet
        ? NotificationType.POST_TIPS
        : NotificationType.POST_TIPS_UNCLAIMED;

      notification.additionalReferenceId = {
        post: {
          id: post.id,
          platform: post.platform,
          user: {
            id: post.user?.id,
            name: post.user?.name,
            username: post.user?.username,
          },
        },
      };
    } else {
      notification.type = toWallet
        ? NotificationType.USER_TIPS
        : NotificationType.USER_TIPS_UNCLAIMED;
    }

    let title = 'Tips Received';
    let body = `${this.currentUser.name} tipped ${notification.message}`;

    if (type === ReferenceType.UNLOCKABLECONTENT) {
      title = 'Content Paid';
      body = `${this.currentUser.name} paid ${notification.message}`;
    }

    await this.sendNotificationToUser(notification, toUserId, title, body);
  }

  async sendRewardSuccess(transaction: Transaction): Promise<void> {
    const {from, to} = transaction;
    const fromUser = await this.userRepository.findById(from);
    const toUser = await this.userRepository.findById(to);

    const tipsActive = await this.checkNotificationSetting(
      toUser.id,
      NotificationType.POST_TIPS,
    );
    if (!tipsActive) return;

    const symbol = await this.getCurrencySymbol(transaction.currencyId);
    const notification = new Notification({
      type: NotificationType.USER_REWARD,
      from: fromUser.id,
      referenceId: transaction.id,
      message: transaction.amount + ' ' + symbol,
    });

    const title = 'Reward Received';
    const body = `Myriad Official sent you ${notification.message}`;

    await this.sendNotificationToUser(notification, toUser.id, title, body);

    return;
  }

  async sendInitialTips(transaction: Transaction): Promise<void> {
    const {from, to} = transaction;
    const fromUser = await this.userRepository.findById(from);
    const toUser = await this.userRepository.findById(to);

    const symbol = await this.getCurrencySymbol(transaction.currencyId);
    const notification = new Notification({
      type: NotificationType.USER_INITIAL_TIPS,
      from: fromUser.id,
      referenceId: transaction.id,
      message: transaction.amount + ' ' + symbol,
    });

    const title = `Welcome to Myriad`;
    const body = `Myriad Official sent you ${notification.message}`;

    await this.sendNotificationToUser(notification, toUser.id, title, body);

    return;
  }

  async sendClaimTips(transaction: Transaction): Promise<boolean> {
    const {to} = transaction;
    const toUser = await this.userRepository.findById(to);

    const tipsActive = await this.checkNotificationSetting(
      toUser.id,
      NotificationType.POST_TIPS,
    );
    if (!tipsActive) return false;

    const symbol = await this.getCurrencySymbol(transaction.currencyId);
    const myriadUserId = await this.getMyriadUserId();
    const notification = new Notification({
      type: NotificationType.USER_CLAIM_TIPS,
      from: myriadUserId,
      referenceId: transaction.id,
      message: transaction.amount + ' ' + symbol,
    });

    const title = 'Claim Tips Success';
    const body = `You claimed ${notification.message}`;

    await this.sendNotificationToUser(notification, toUser.id, title, body);

    return true;
  }

  async sendConnectedSocialMedia(
    userSocialMedia: UserSocialMediaWithRelations,
  ) {
    const {userId, platform, people} = userSocialMedia;

    const notification = new Notification({
      type: NotificationType.CONNECTED_SOCIAL_MEDIA,
      from: userId,
      referenceId: userId,
      message: `connected to your ${capitalize(platform)} account`,
      additionalReferenceId: {
        people: {
          id: people?.id,
          name: people?.name,
          username: people?.username,
          platform: people?.platform,
        },
      },
    });

    const title = `Connected to ${
      platform[0].toUpperCase() + platform.substring(1)
    } Success`;
    const body = `Your Myriad account is now ${notification.message}`;

    await this.sendNotificationToUser(notification, userId, title, body);

    return;
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
      message: `disconnected from your ${capitalize(platform)} account`,
      additionalReferenceId: {
        people: {
          id: people?.id,
          name: people?.name,
          username: people?.username,
          platform: people?.platform,
        },
      },
    });

    const title = `Disconnected from ${
      platform[0].toUpperCase() + platform.substring(1)
    } Success`;
    const body = `Your Myriad account is now ${notification.message}`;

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

    if (!createdNotifications?.length) return;

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
        if (!found) return;
        return this.fcmService.sendNotification(
          user.fcmTokens,
          title,
          body,
          found,
        );
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

        case NotificationType.PAID_CONTENT:
        case NotificationType.POST_TIPS:
        case NotificationType.COMMENT_TIPS:
        case NotificationType.USER_TIPS:
          if (!notificationSetting.tips) return false;
          break;

        case NotificationType.POST_VOTE:
        case NotificationType.COMMENT_VOTE:
          if (!notificationSetting.upvotes) return false;
          break;

        default:
          return false;
      }
    }

    return true;
  }

  async getMyriadUserId(): Promise<string> {
    const user = await this.userRepository.findOne({
      where: {username: 'myriad_official'},
    });
    if (!user) throw new HttpErrors.NotFound('User not found');
    return user.id;
  }

  async getCurrencySymbol(currencyId: string): Promise<string> {
    const currency = await this.currencyRepository.findById(currencyId);
    return currency.symbol;
  }
}

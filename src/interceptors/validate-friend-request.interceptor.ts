import {
  injectable,
  Interceptor,
  InvocationContext,
  InvocationResult,
  Provider,
  service,
  ValueOrPromise,
} from '@loopback/core';
import {HttpErrors} from '@loopback/rest';
import {
  ActivityLogType,
  FriendStatusType,
  MethodType,
  ReferenceType,
} from '../enums';
import {
  ActivityLogService,
  FriendService,
  MetricService,
  NotificationService,
} from '../services';

/**
 * This class will be bound to the application as an `Interceptor` during
 * `boot`
 */
@injectable({tags: {key: ValidateFriendRequestInterceptor.BINDING_KEY}})
export class ValidateFriendRequestInterceptor implements Provider<Interceptor> {
  static readonly BINDING_KEY = `interceptors.${ValidateFriendRequestInterceptor.name}`;

  constructor(
    @service(ActivityLogService)
    protected activityLogService: ActivityLogService,
    @service(FriendService)
    protected friendService: FriendService,
    @service(MetricService)
    protected metricService: MetricService,
    @service(NotificationService)
    protected notificationService: NotificationService,
  ) {}

  /**
   * This method is used by LoopBack context to produce an interceptor function
   * for the binding.
   *
   * @returns An interceptor function
   */
  value() {
    return this.intercept.bind(this);
  }

  /**
   * The logic to intercept an invocation
   * @param invocationCtx - Invocation context
   * @param next - A function to invoke next interceptor or the target method
   */
  async intercept(
    invocationCtx: InvocationContext,
    next: () => ValueOrPromise<InvocationResult>,
  ) {
    const methodName = invocationCtx.methodName as MethodType;

    let friendId = null;
    let requesteeId = null;
    let requestorId = null;
    let status = null;

    switch (methodName) {
      case MethodType.UPDATEBYID: {
        friendId = invocationCtx.args[0];
        status = invocationCtx.args[1].status;

        if (status !== FriendStatusType.APPROVED)
          throw new HttpErrors.UnprocessableEntity(
            'Only accept approved friend request!',
          );

        break;
      }

      case MethodType.DELETEBYID:
        friendId = invocationCtx.args[0];
        break;

      default:
        ({requestorId, requesteeId, status} = invocationCtx.args[0]);

        if (status === FriendStatusType.APPROVED)
          throw new HttpErrors.UnprocessableEntity(
            'Please set status to pending or blocked',
          );
    }

    switch (status) {
      // Handle add method when pending friend
      case FriendStatusType.PENDING: {
        await this.friendService.validatePendingFriendRequest(
          requesteeId,
          requestorId,
        );
        await this.createNotification(requesteeId, requestorId, status);

        break;
      }

      // Handle updateById method
      case FriendStatusType.APPROVED: {
        ({requestorId, requesteeId} =
          await this.friendService.validateApproveFriendRequest(friendId));
        await this.createNotification(requesteeId, requestorId, status);
        break;
      }

      // Handle add method when blocked friend
      case FriendStatusType.BLOCKED: {
        await this.friendService.validateBlockFriendRequest(
          requestorId,
          requesteeId,
        );
        break;
      }

      // For handle deleteById method
      default:
        ({requesteeId, requestorId} = await this.friendService.removedFriend(
          friendId,
        ));
        await this.createNotification(requesteeId, requestorId);
    }

    // Add pre-invocation logic here
    const result = await next();
    // Add post-invocation logic here

    if (
      methodName === MethodType.UPDATEBYID ||
      methodName === MethodType.DELETEBYID
    ) {
      await this.metricService.userMetric(requestorId);
      await this.metricService.userMetric(requesteeId);
    }

    if (result && result.status === FriendStatusType.PENDING) {
      await this.activityLogService.createLog(
        ActivityLogType.FRIENDREQUEST,
        requestorId,
        requesteeId,
        ReferenceType.USER,
      );
    }

    return result;
  }

  async createNotification(
    requesteeId: string,
    requestorId: string,
    status?: FriendStatusType,
  ): Promise<void> {
    try {
      if (status === FriendStatusType.PENDING) {
        await this.notificationService.sendFriendRequest(requesteeId);
        return;
      }

      if (status === FriendStatusType.APPROVED) {
        await this.notificationService.sendFriendAccept(requestorId);
        return;
      }

      await this.notificationService.cancelFriendRequest(
        requestorId,
        requesteeId,
      );
    } catch {
      // ignore
    }

    return;
  }
}

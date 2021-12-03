import {expect, toJSON} from '@loopback/testlab';
import {FriendController} from '../../../controllers';
import {FriendStatusType, NotificationType} from '../../../enums';
import {Friend} from '../../../models';
import {
  FriendRepository,
  NotificationRepository,
  UserRepository,
} from '../../../repositories';
import {
  FriendService,
  MetricService,
  NotificationService,
} from '../../../services';
import {
  givenEmptyDatabase,
  givenFriend,
  givenFriendInstance,
  givenRepositories,
  givenUserInstance,
  testdb,
} from '../../helpers';

describe('FriendControllerIntegration', () => {
  let userRepository: UserRepository;
  let friendRepository: FriendRepository;
  let notificationRepository: NotificationRepository;
  let notificationService: NotificationService;
  let friendService: FriendService;
  let metricService: MetricService;
  let controller: FriendController;

  before(async () => {
    ({
      userRepository,
      friendRepository,
      notificationRepository,
      notificationService,
      friendService,
      metricService,
    } = await givenRepositories(testdb));
  });

  before(async () => {
    controller = new FriendController(
      notificationService,
      friendService,
      metricService,
    );
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes Requestee in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });

    const friend = await givenFriendInstance(friendRepository, {
      requesteeId: user.id,
      requestorId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });

    const response = await controller.find({include: ['requestee']});

    expect(response).to.containDeep([
      {
        ...friend,
        requestee: user,
      },
    ]);
  });

  it('includes Requestor in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const friend = await givenFriendInstance(friendRepository, {
      requestorId: user.id,
      requesteeId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });
    const response = await controller.find({include: ['requestor']});

    expect(response).to.containDeep([
      {
        ...friend,
        requestor: user,
      },
    ]);
  });

  it('includes both Requestor and Requestee in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });
    const friend = await givenFriendInstance(friendRepository, {
      requestorId: user.id,
      requesteeId: otherUser.id,
    });
    const response = await controller.find({
      include: ['requestor', 'requestee'],
    });

    expect(response).to.containDeep([
      {
        ...friend,
        requestor: user,
        requestee: otherUser,
      },
    ]);
  });

  it('includes Requestee in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });

    const friend = await givenFriendInstance(friendRepository, {
      requesteeId: user.id,
      requestorId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });

    const response = await controller.findById(friend.id ?? '', {
      include: ['requestee'],
    });

    expect(response).to.containDeep({
      ...friend,
      requestee: user,
    });
  });

  it('includes Requestor in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const friend = await givenFriendInstance(friendRepository, {
      requestorId: user.id,
      requesteeId:
        '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });

    const response = await controller.findById(friend.id ?? '', {
      include: ['requestor'],
    });

    expect(response).to.containDeep({
      ...friend,
      requestor: user,
    });
  });

  it('includes both Requestor and Requestee in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });
    const friend = await givenFriendInstance(friendRepository, {
      requestorId: user.id,
      requesteeId: otherUser.id,
    });

    const response = await controller.findById(friend.id ?? '', {
      include: ['requestor', 'requestee'],
    });

    expect(response).to.containDeep({
      ...friend,
      requestor: user,
      requestee: otherUser,
    });
  });

  it('creates notification when sending a pending friend request', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });

    const friendInstance = givenFriend({
      requestorId: user.id,
      requesteeId: otherUser.id,
    });

    const friend = await controller.add(friendInstance);

    const notifications = await notificationRepository.find({
      where: {
        from: friend.requestorId,
        to: friend.requesteeId,
        referenceId: friend.requestorId,
      },
    });

    delete notifications[0].id;
    delete notifications[0].createdAt;
    delete notifications[0].updatedAt;

    expect({
      type: NotificationType.FRIEND_REQUEST,
      from: friend.requestorId,
      read: false,
      to: friend.requesteeId,
      referenceId: friend.requestorId,
      additionalReferenceId: [],
      message: 'sent you friend request',
    }).to.containDeep(toJSON(notifications[0]));
  });

  it('creates notification when approving a pending friend request', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const otherUser = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618ac',
    });

    const friend = await givenFriendInstance(friendRepository, {
      requestorId: user.id,
      requesteeId: otherUser.id,
    });

    await controller.updateById(friend.id ?? '', {
      status: FriendStatusType.APPROVED,
      requestorId: user.id,
      requesteeId: otherUser.id,
    } as Omit<Friend, 'id'>);

    const notifications = await notificationRepository.find({
      where: {
        from: friend.requesteeId,
        to: friend.requestorId,
        referenceId: friend.requesteeId,
      },
    });

    delete notifications[0].id;
    delete notifications[0].createdAt;
    delete notifications[0].updatedAt;

    expect({
      type: NotificationType.FRIEND_ACCEPT,
      from: friend.requesteeId,
      read: false,
      to: friend.requestorId,
      referenceId: friend.requesteeId,
      additionalReferenceId: [],
      message: 'accept your friend request',
    }).to.containEql(toJSON(notifications[0]));
  });
});

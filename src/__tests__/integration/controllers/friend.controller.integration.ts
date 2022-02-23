import {expect} from '@loopback/testlab';
import {FriendController} from '../../../controllers';
import {FriendRepository, UserRepository} from '../../../repositories';
import {
  givenEmptyDatabase,
  givenFriendInstance,
  givenRepositories,
  givenUserInstance,
  testdb,
} from '../../helpers';

describe('FriendControllerIntegration', () => {
  let userRepository: UserRepository;
  let friendRepository: FriendRepository;
  let controller: FriendController;

  before(async () => {
    ({userRepository, friendRepository, userRepository} =
      await givenRepositories(testdb));
  });

  before(async () => {
    controller = new FriendController(friendRepository);
  });

  before(async () => {
    ({userRepository, friendRepository, userRepository} =
      await givenRepositories(testdb));
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
});

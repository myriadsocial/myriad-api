import {expect} from '@loopback/testlab';
import {FriendController} from '../../../controllers';
import {FriendRepository, UserRepository} from '../../../repositories';
import {UserService} from '../../../services';
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
  let userService: UserService;
  let controller: FriendController;

  before(async () => {
    ({userRepository, friendRepository, userRepository, userService} =
      await givenRepositories(testdb));
  });

  before(async () => {
    controller = new FriendController(userService);
  });

  before(async () => {
    ({userRepository, friendRepository, userRepository} =
      await givenRepositories(testdb));
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes Requestee in find method result', async () => {
    const user = await givenUserInstance(userRepository);

    const friend = await givenFriendInstance(friendRepository, {
      requesteeId: user.id,
      requestorId: '9999',
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
    const user = await givenUserInstance(userRepository);
    const friend = await givenFriendInstance(friendRepository, {
      requestorId: user.id,
      requesteeId: '9999',
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
    const user = await givenUserInstance(userRepository);
    const otherUser = await givenUserInstance(userRepository, {
      username: 'johdoe',
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
});

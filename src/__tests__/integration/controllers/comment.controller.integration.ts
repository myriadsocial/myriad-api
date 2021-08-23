import {expect} from '@loopback/testlab';
import {CommentController} from '../../../controllers';
import {TransactionType} from '../../../enums';
import {
  CommentRepository,
  NotificationRepository,
  PostRepository,
  TransactionRepository,
  UserRepository,
} from '../../../repositories';
import {FCMService, NotificationService} from '../../../services';
import {
  givenCommentInstance,
  givenEmptyDatabase,
  givenPostInstance,
  givenRepositories,
  givenTransactionInstance,
  givenUserInstance,
} from '../../helpers';

describe('CommentControllerIntegration', () => {
  let commentRepository: CommentRepository;
  let userRepository: UserRepository;
  let postRepository: PostRepository;
  let transactionRepository: TransactionRepository;
  let controller: CommentController;
  let notificationRepository: NotificationRepository;
  let notificationService: NotificationService;
  let fcmService: FCMService;

  before(async () => {
    ({
      userRepository,
      commentRepository,
      postRepository,
      notificationRepository,
      transactionRepository,
    } = await givenRepositories());
  });

  before(async () => {
    notificationService = new NotificationService(
      userRepository,
      postRepository,
      notificationRepository,
      fcmService,
    );
    controller = new CommentController(commentRepository, notificationService);
  });

  beforeEach(givenEmptyDatabase);

  it('includes Transactions in find method result', async () => {
    const comment = await givenCommentInstance(commentRepository, {
      userId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      postId: '1',
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: comment.id,
      type: TransactionType.COMMENT,
    });

    const response = await controller.find({include: ['transactions']});

    expect(response).to.containDeep([
      {
        ...comment,
        transactions: [transaction],
      },
    ]);
  });

  it('includes Post in find method result', async () => {
    const post = await givenPostInstance(postRepository);
    const comment = await givenCommentInstance(commentRepository, {
      userId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      postId: post.id,
    });
    const response = await controller.find({include: ['post']});

    expect(response).to.containDeep([
      {
        ...comment,
        post: post,
      },
    ]);
  });

  it('includes User in find method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: '1',
    });

    const response = await controller.find({include: ['user']});

    expect(response).to.containDeep([
      {
        ...comment,
        user: user,
      },
    ]);
  });

  it('includes Transaction, Post, and User in find method result', async () => {
    const post = await givenPostInstance(postRepository);
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: post.id,
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: comment.id,
      type: TransactionType.COMMENT,
    });

    const response = await controller.find({include: ['user', 'transactions', 'post']});

    expect(response).to.containDeep([
      {
        ...comment,
        user: user,
        post: post,
        transactions: [transaction],
      },
    ]);
  });

  it('includes Transactions in findById method result', async () => {
    const comment = await givenCommentInstance(commentRepository, {
      userId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      postId: '1',
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: comment.id,
      type: TransactionType.COMMENT,
    });

    if (comment.id) {
      const response = await controller.findById(comment.id, {include: ['transactions']});

      expect(response).to.containDeep({
        ...comment,
        transactions: [transaction],
      });
    }
  });

  it('includes Post in findById method result', async () => {
    const post = await givenPostInstance(postRepository);
    const comment = await givenCommentInstance(commentRepository, {
      userId: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
      postId: post.id,
    });

    if (comment.id) {
      const response = await controller.findById(comment.id, {include: ['post']});

      expect(response).to.containDeep({
        ...comment,
        post: post,
      });
    }
  });

  it('includes User in findById method result', async () => {
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: '1',
    });

    if (comment.id) {
      const response = await controller.findById(comment.id, {include: ['user']});

      expect(response).to.containDeep({
        ...comment,
        user: user,
      });
    }
  });

  it('includes Transaction, Post, and User in findById method result', async () => {
    const post = await givenPostInstance(postRepository);
    const user = await givenUserInstance(userRepository, {
      id: '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee618bc',
    });
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: post.id,
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: comment.id,
      type: TransactionType.COMMENT,
    });

    if (comment.id) {
      const response = await controller.findById(comment.id, {
        include: ['user', 'transactions', 'post'],
      });

      expect(response).to.containDeep({
        ...comment,
        user: user,
        post: post,
        transactions: [transaction],
      });
    }
  });
});

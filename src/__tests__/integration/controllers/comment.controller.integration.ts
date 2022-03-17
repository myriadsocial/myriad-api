import {expect} from '@loopback/testlab';
import {CommentController} from '../../../controllers';
import {ReferenceType} from '../../../enums';
import {
  CommentRepository,
  PostRepository,
  TransactionRepository,
  UserRepository,
} from '../../../repositories';
import {
  givenComment,
  givenCommentInstance,
  givenEmptyDatabase,
  givenPostInstance,
  givenRepositories,
  givenTransactionInstance,
  givenUserInstance,
  testdb,
} from '../../helpers';

describe('CommentControllerIntegration', () => {
  let commentRepository: CommentRepository;
  let userRepository: UserRepository;
  let postRepository: PostRepository;
  let transactionRepository: TransactionRepository;
  let controller: CommentController;

  before(async () => {
    ({
      commentRepository,
      postRepository,
      transactionRepository,
      userRepository,
    } = await givenRepositories(testdb));
  });

  before(async () => {
    controller = new CommentController(commentRepository);
  });

  beforeEach(async () => {
    await givenEmptyDatabase(testdb);
  });

  it('includes Transactions in find method result', async () => {
    const comment = await givenCommentInstance(commentRepository, {
      userId: '9999',
      postId: '1',
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });

    const response = await controller.find({include: ['transactions']});

    expect(response).to.containDeep([
      {
        ...comment,
        transactions: [transaction],
      },
    ]);
  });

  it('includes User in find method result', async () => {
    const user = await givenUserInstance(userRepository);
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

  it('includes two levels Comments in find method result', async () => {
    const user = await givenUserInstance(userRepository);
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: '9999',
      referenceId: '9999',
    });
    const otherComment = givenComment({
      userId: user.id,
      postId: '9999',
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });
    const newOtherComment = await commentRepository
      .comments(comment.id)
      .create(otherComment);

    const anotherComment = givenComment({
      userId: user.id,
      postId: '9999',
      referenceId: newOtherComment.id,
      type: ReferenceType.COMMENT,
    });

    const newAnotherComment = await commentRepository
      .comments(newOtherComment.id)
      .create(anotherComment);

    const response = await controller.find({
      include: [
        {
          relation: 'comments',
          scope: {
            include: ['comments'],
          },
        },
      ],
    });

    expect(response).to.containDeep([
      {
        ...comment,
        comments: [
          {
            ...newOtherComment,
            comments: [newAnotherComment],
          },
        ],
      },
    ]);
  });

  it('includes Transaction, User, and two levels Comments in find method result', async () => {
    const post = await givenPostInstance(postRepository);
    const user = await givenUserInstance(userRepository);
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: post.id,
      referenceId: post.id,
      type: ReferenceType.POST,
    });
    const otherComment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });
    const newOtherComment = await commentRepository
      .comments(comment.id)
      .create(otherComment);

    const anotherComment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: newOtherComment.id,
      type: ReferenceType.COMMENT,
    });

    const newAnotherComment = await commentRepository
      .comments(newOtherComment.id)
      .create(anotherComment);

    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });

    const response = await controller.find({
      include: [
        {
          relation: 'user',
        },
        {
          relation: 'transactions',
        },
        {
          relation: 'comments',
          scope: {
            include: ['comments'],
          },
        },
      ],
    });

    expect(response).to.containDeep([
      {
        ...comment,
        user: user,
        transactions: [transaction],
        comments: [
          {
            ...newOtherComment,
            comments: [newAnotherComment],
          },
        ],
      },
    ]);
  });

  it('includes Transactions in findById method result', async () => {
    const comment = await givenCommentInstance(commentRepository, {
      userId: '9999',
      postId: '1',
    });
    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });

    const response = await controller.findById(comment.id ?? '', {
      include: ['transactions'],
    });

    expect(response).to.containDeep({
      ...comment,
      transactions: [transaction],
    });
  });

  it('includes User in findById method result', async () => {
    const user = await givenUserInstance(userRepository);
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: '1',
    });

    const response = await controller.findById(comment.id ?? '', {
      include: ['user'],
    });

    expect(response).to.containDeep({
      ...comment,
      user: user,
    });
  });

  it('includes two levels Comments in findById method result', async () => {
    const user = await givenUserInstance(userRepository);
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: '9999',
      referenceId: '9999',
    });
    const otherComment = givenComment({
      userId: user.id,
      postId: '9999',
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });
    const newOtherComment = await commentRepository
      .comments(comment.id)
      .create(otherComment);

    const anotherComment = givenComment({
      userId: user.id,
      postId: '9999',
      referenceId: newOtherComment.id,
      type: ReferenceType.COMMENT,
    });

    const newAnotherComment = await commentRepository
      .comments(newOtherComment.id)
      .create(anotherComment);

    const response = await controller.findById(comment.id ?? '', {
      include: [
        {
          relation: 'comments',
          scope: {
            include: ['comments'],
          },
        },
      ],
    });

    expect(response).to.containDeep({
      ...comment,
      comments: [
        {
          ...newOtherComment,
          comments: [newAnotherComment],
        },
      ],
    });
  });

  it('includes Transaction, User, and two levels Comments in findById method result', async () => {
    const post = await givenPostInstance(postRepository);
    const user = await givenUserInstance(userRepository);
    const comment = await givenCommentInstance(commentRepository, {
      userId: user.id,
      postId: post.id,
      referenceId: post.id,
      type: ReferenceType.POST,
    });
    const otherComment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });
    const newOtherComment = await commentRepository
      .comments(comment.id)
      .create(otherComment);

    const anotherComment = givenComment({
      userId: user.id,
      postId: post.id,
      referenceId: newOtherComment.id,
      type: ReferenceType.COMMENT,
    });

    const newAnotherComment = await commentRepository
      .comments(newOtherComment.id)
      .create(anotherComment);

    const transaction = await givenTransactionInstance(transactionRepository, {
      referenceId: comment.id,
      type: ReferenceType.COMMENT,
    });

    const response = await controller.findById(comment.id ?? '', {
      include: [
        {
          relation: 'user',
        },
        {
          relation: 'transactions',
        },
        {
          relation: 'comments',
          scope: {
            include: ['comments'],
          },
        },
      ],
    });

    expect(response).to.containDeep({
      ...comment,
      user: user,
      transactions: [transaction],
      comments: [
        {
          ...newOtherComment,
          comments: [newAnotherComment],
        },
      ],
    });
  });
});

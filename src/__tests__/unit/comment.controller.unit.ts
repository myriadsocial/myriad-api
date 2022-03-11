import {
  createStubInstance,
  expect,
  sinon,
  StubbedInstanceWithSinonAccessor,
  toJSON,
} from '@loopback/testlab';
import {CommentController} from '../../controllers';
import {Comment} from '../../models';
import {CommentRepository} from '../../repositories';
import {givenComment} from '../helpers';

describe('CommentController', () => {
  let commentRepository: StubbedInstanceWithSinonAccessor<CommentRepository>;
  let controller: CommentController;
  let aComment: Comment;
  let aCommentWithId: Comment;
  let aChangedComment: Comment;
  let aListOfComments: Comment[];

  beforeEach(resetRepositories);

  describe('createComment', () => {
    it('creates a Comment', async () => {
      const create = commentRepository.stubs.create;
      create.resolves(aCommentWithId);
      const result = await controller.create(aComment);
      expect(result).to.eql(aCommentWithId);
      sinon.assert.calledWith(create, aComment);
    });
  });

  describe('findCommentById', () => {
    it('returns a user if it exists', async () => {
      const findById = commentRepository.stubs.findById;
      findById.resolves(aCommentWithId);
      expect(await controller.findById(aCommentWithId.id as string)).to.eql(
        aCommentWithId,
      );
      sinon.assert.calledWith(findById, aCommentWithId.id);
    });
  });

  describe('findComments', () => {
    it('returns multiple comments if they exist', async () => {
      const find = commentRepository.stubs.find;
      find.resolves(aListOfComments);
      expect(await controller.find()).to.eql(aListOfComments);
      sinon.assert.called(find);
    });

    it('returns empty list if no comments exist', async () => {
      const find = commentRepository.stubs.find;
      const expected: Comment[] = [];
      find.resolves(expected);
      expect(await controller.find()).to.eql(expected);
      sinon.assert.called(find);
    });

    it('uses the provided filter', async () => {
      const find = commentRepository.stubs.find;
      const filter = toJSON({where: {id: '1'}});

      find.resolves(aListOfComments);
      await controller.find(filter);
      sinon.assert.calledWith(find, filter);
    });
  });

  describe('updateComment', () => {
    it('successfully updates existing items', async () => {
      const updateById = commentRepository.stubs.updateById;
      updateById.resolves();
      await controller.updateById(aCommentWithId.id as string, aChangedComment);
      sinon.assert.calledWith(updateById, aCommentWithId.id, aChangedComment);
    });
  });

  function resetRepositories() {
    commentRepository = createStubInstance(CommentRepository);
    aComment = givenComment();
    aCommentWithId = givenComment({
      id: '1',
    });
    aListOfComments = [
      aCommentWithId,
      givenComment({
        id: '2',
        text: 'hello',
      }),
    ] as Comment[];
    aChangedComment = givenComment({
      id: aCommentWithId.id,
      text: "what's up",
    });

    controller = new CommentController(commentRepository);
  }
});

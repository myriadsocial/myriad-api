import {Count, DefaultHasManyRepository, HasManyRepository} from '@loopback/repository';
import {
  createStubInstance,
  expect,
  sinon,
  StubbedInstanceWithSinonAccessor,
} from '@loopback/testlab';
import {PostCommentController} from '../../controllers';
import {Comment, Post} from '../../models';
import {PostRepository} from '../../repositories';
import {NotificationService} from '../../services';
import {givenComment, givenPost} from '../helpers';

describe('PostCommentController', () => {
  let postRepository: StubbedInstanceWithSinonAccessor<PostRepository>;
  let constrainedCommentRepository: StubbedInstanceWithSinonAccessor<HasManyRepository<Comment>>;
  let notificationService: NotificationService;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  /*
  =============================================================================
  REPOSITORY FACTORY STUB
  This handle give us a quick way to fake the response of our repository
  without needing to wrangle fake repository objects or manage real ones
  in our tests themselves.
  =============================================================================
   */
  let comments: sinon.SinonStub<any[], Comment[]>;

  /*
  =============================================================================
  METHOD STUBS
  These handles give us a quick way to fake the response of our repository
  without needing to wrangle fake repository objects or manage real ones
  in our tests themselves.
  =============================================================================
   */
  let create: sinon.SinonStub<any[], Promise<Comment>>;
  let find: sinon.SinonStub<any[], Promise<Comment[]>>;
  let patch: sinon.SinonStub<any[], Promise<Count>>;
  let del: sinon.SinonStub<any[], Promise<Count>>;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  /*
  =============================================================================
  TEST VARIABLES
  Combining top-level objects with our resetRepositories method means we don't
  need to duplicate several variable assignments (and generation statements)
  in all of our test logic.
  NOTE: If you wanted to parallelize your test runs, you should avoid this
  pattern since each of these tests is sharing references.
  =============================================================================
  */
  let controller: PostCommentController;
  let aPostWithId: Post;
  let aComment: Comment;
  let aCommentWithId: Comment;
  let aListOfComments: Comment[];
  let aCommentToPatchTo: Comment;
  let aChangedComment: Comment;

  beforeEach(resetRepositories);

  describe('create()', () => {
    it('creates a comment on a post', async () => {
      create.resolves(aCommentWithId);
      expect(await controller.create(aPostWithId.id!, aComment)).to.eql(aCommentWithId);
      sinon.assert.calledWith(comments, aPostWithId.id!);
      sinon.assert.calledWith(create, aComment);
    });
  });

  describe('find()', () => {
    it('returns multiple comments if they exist', async () => {
      find.resolves(aListOfComments);
      expect(await controller.find(aPostWithId.id!)).to.eql(aListOfComments);
      sinon.assert.calledWith(comments, aPostWithId.id!);
      sinon.assert.called(find);
    });

    it('returns empty list if no comments exist', async () => {
      const expected: Comment[] = [];
      find.resolves(expected);
      expect(await controller.find(aPostWithId.id!)).to.eql(expected);
      sinon.assert.calledWith(comments, aPostWithId.id!);
      sinon.assert.called(find);
    });
  });

  describe('patch()', () => {
    it('returns a number of comments updated', async () => {
      patch.resolves({count: [aChangedComment].length});
      const where = {text: aCommentWithId.text};
      expect(await controller.patch(aPostWithId.id!, aCommentToPatchTo, where)).to.eql({count: 1});
      sinon.assert.calledWith(comments, aPostWithId.id!);
      sinon.assert.calledWith(patch, aCommentToPatchTo, where);
    });
  });

  describe('deleteAll()', () => {
    it('returns a number of todos deleted', async () => {
      del.resolves({count: aListOfComments.length});
      expect(await controller.delete(aPostWithId.id!)).to.eql({
        count: aListOfComments.length,
      });
      sinon.assert.calledWith(comments, aPostWithId.id!);
      sinon.assert.called(del);
    });
  });

  function resetRepositories() {
    postRepository = createStubInstance(PostRepository);
    constrainedCommentRepository =
      createStubInstance<HasManyRepository<Comment>>(DefaultHasManyRepository);

    aPostWithId = givenPost({
      id: '1',
    });

    aComment = givenComment();
    aCommentWithId = givenComment({id: '1'});
    aListOfComments = [
      aCommentWithId,
      givenComment({
        id: '2',
        text: 'do another thing',
      }),
    ] as Comment[];
    aCommentToPatchTo = givenComment({
      text: 'revised thing to do',
    });
    aChangedComment = givenComment({
      id: aCommentWithId.id,
      text: aCommentToPatchTo.text,
    });

    comments = sinon.stub().withArgs(aPostWithId.id!).returns(constrainedCommentRepository);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (postRepository as any).comments = comments;

    // Setup CRUD fakes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({create, find, patch, delete: del} = constrainedCommentRepository.stubs as any);

    controller = new PostCommentController(postRepository, notificationService);
  }
});

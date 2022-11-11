import {
  createStubInstance,
  expect,
  sinon,
  StubbedInstanceWithSinonAccessor,
  toJSON,
} from '@loopback/testlab';
import {PostController} from '../../controllers';
import {PlatformType} from '../../enums';
import {Post} from '../../models';
import {
  AccountSettingRepository,
  DraftPostRepository,
  ExperiencePostRepository,
  FriendRepository,
  PeopleRepository,
  PostRepository,
} from '../../repositories';
import {PostService} from '../../services';
import {givenMyriadPost} from '../helpers';
import {securityId} from '@loopback/security';
import {UserService} from '../../services/user.service';

describe('PostController', () => {
  let accountSettingRepository: StubbedInstanceWithSinonAccessor<AccountSettingRepository>;
  let postRepository: StubbedInstanceWithSinonAccessor<PostRepository>;
  let draftPostRepository: StubbedInstanceWithSinonAccessor<DraftPostRepository>;
  let peopleRepository: StubbedInstanceWithSinonAccessor<PeopleRepository>;
  let friendRepository: StubbedInstanceWithSinonAccessor<FriendRepository>;
  let experiencePostRepository: StubbedInstanceWithSinonAccessor<ExperiencePostRepository>;
  let postService: PostService;
  let userService: UserService;
  let controller: PostController;
  let aPostWithId: Post;
  let aChangedPost: Post;
  let aListOfPosts: Post[];

  beforeEach(resetRepositories);

  describe('findPosts', () => {
    it('returns multiple posts if they exist', async () => {
      const find = postRepository.stubs.find;
      find.resolves(aListOfPosts);
      expect(await controller.getTimeline()).to.eql(aListOfPosts);
      sinon.assert.called(find);
    });

    it('returns empty list if no posts exist', async () => {
      const find = postRepository.stubs.find;
      const expected: Post[] = [];
      find.resolves(expected);
      expect(await controller.getTimeline()).to.eql(expected);
      sinon.assert.called(find);
    });

    it('uses the provided filter', async () => {
      const find = postRepository.stubs.find;
      const filter = toJSON({where: {text: 'hello world'}});

      find.resolves(aListOfPosts);
      await controller.getTimeline(filter);
      sinon.assert.calledWith(find, filter);
    });
  });

  describe('updatePost', () => {
    it('successfully updates existing items', async () => {
      const updateById = postRepository.stubs.updateById;
      updateById.resolves();
      await controller.updateById(aPostWithId.id as string, aChangedPost);
      sinon.assert.calledWith(updateById, aPostWithId.id, aChangedPost);
    });
  });

  function resetRepositories() {
    accountSettingRepository = createStubInstance(AccountSettingRepository);
    postRepository = createStubInstance(PostRepository);
    draftPostRepository = createStubInstance(DraftPostRepository);
    peopleRepository = createStubInstance(PeopleRepository);
    experiencePostRepository = createStubInstance(ExperiencePostRepository);
    aPostWithId = givenMyriadPost({
      id: '1',
    });
    aListOfPosts = [
      aPostWithId,
      givenMyriadPost({
        id: '2',
        text: 'wow',
        platform: PlatformType.MYRIAD,
        tags: ['wow'],
        createdBy:
          '0x06cc7ed22ebd12ccc28fb9c0d14a5c4420a331d89a5fef48b915e8449ee61863',
      }),
    ] as Post[];
    aChangedPost = givenMyriadPost({
      id: aPostWithId.id,
      text: 'woah',
    });

    postService = new PostService(
      postRepository,
      accountSettingRepository,
      draftPostRepository,
      experiencePostRepository,
      friendRepository,
      peopleRepository,
      {[securityId]: ''},
    );
    controller = new PostController(postService, userService);
  }
});

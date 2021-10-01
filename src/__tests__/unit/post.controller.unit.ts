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
import {PeopleRepository, PostRepository} from '../../repositories';
import {PostService, SocialMediaService} from '../../services';
import {givenMyriadPost} from '../helpers';

describe('PostController', () => {
  let postRepository: StubbedInstanceWithSinonAccessor<PostRepository>;
  let peopleRepository: PeopleRepository;
  let postService: PostService;
  let socialMediaService: SocialMediaService;
  let controller: PostController;
  let aPost: Post;
  let aPostWithId: Post;
  let aChangedPost: Post;
  let aListOfPosts: Post[];

  beforeEach(resetRepositories);

  describe('createPost', () => {
    it('creates a Post', async () => {
      const create = postRepository.stubs.create;
      create.resolves(aPostWithId);
      const result = await controller.create(aPost);
      expect(result).to.eql(aPostWithId);
      sinon.assert.calledWith(create, aPost);
    });
  });

  describe('findPostById', () => {
    it('returns a post if it exists', async () => {
      const findById = postRepository.stubs.findById;
      findById.resolves(aPostWithId);
      expect(await controller.findById(aPostWithId.id as string)).to.eql(
        aPostWithId,
      );
      sinon.assert.calledWith(findById, aPostWithId.id);
    });
  });

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
    postRepository = createStubInstance(PostRepository);
    aPost = givenMyriadPost();
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

    postService = new PostService(postRepository, peopleRepository);
    controller = new PostController(socialMediaService, postService);
  }
});

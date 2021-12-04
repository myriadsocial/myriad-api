import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {ExtendedPost} from '../interfaces';
import {Post, PostWithRelations, User} from '../models';
import {
  PeopleRepository,
  PostRepository,
  CommentRepository,
  FriendRepository,
  UserRepository,
} from '../repositories';
import {PolkadotJs} from '../utils/polkadotJs-utils';
import {injectable, BindingScope} from '@loopback/core';
import {BcryptHasher} from './authentication/hash.password.service';
import {config} from '../config';
import {PlatformType} from '../enums';

@injectable({scope: BindingScope.TRANSIENT})
export class PostService {
  constructor(
    @repository(PostRepository)
    public postRepository: PostRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(FriendRepository)
    protected friendRepository: FriendRepository,
    @repository(UserRepository)
    protected userRepository: UserRepository,
  ) {}

  async createPost(post: Omit<ExtendedPost, 'id'>): Promise<PostWithRelations> {
    const {platformUser, platform} = post;
    const {getKeyring, getHexPublicKey} = new PolkadotJs();

    if (!platformUser)
      throw new HttpErrors.NotFound('Platform user not found!');

    let people = await this.peopleRepository.findOne({
      where: {
        originUserId: platformUser.originUserId,
        platform: platform,
      },
    });

    if (!people) {
      people = await this.peopleRepository.create(platformUser);

      const hasher = new BcryptHasher();
      const hashPeopleId = await hasher.hashPassword(
        people.id + config.ESCROW_SECRET_KEY,
      );
      const newKey = getKeyring().addFromUri('//' + hashPeopleId);

      await this.peopleRepository.updateById(people.id, {
        walletAddress: getHexPublicKey(newKey),
      });
    }

    delete post.platformUser;

    const newPost: PostWithRelations = await this.postRepository.create(
      Object.assign(post, {peopleId: people.id}),
    );

    return Object.assign(newPost, {people: people});
  }

  async deletePost(id: string): Promise<void> {
    await this.postRepository.deleteById(id);
    await this.commentRepository.deleteAll({
      postId: id,
    });
  }

  async getPostImporterInfo(
    post: PostWithRelations,
    userId?: string,
  ): Promise<Post> {
    if (post.platform === PlatformType.MYRIAD) return post;
    if (!post.user) return post;
    if (!userId) return post;

    const importer = new User({...post.user});

    if (userId) {
      let isFriend = false;

      if (userId !== post.createdBy) {
        const friend = await this.friendRepository.findOne({
          where: {
            or: [
              {
                requesteeId: userId,
                requestorId: post.createdBy,
              },
              {
                requestorId: userId,
                requesteeId: post.createdBy,
              },
            ],
          },
        });

        if (friend) isFriend = true;
      } else {
        importer.name = 'You';
        isFriend = true;
      }

      if (!isFriend) return post;
      post.importers = [importer];
    }

    return post;
  }
}

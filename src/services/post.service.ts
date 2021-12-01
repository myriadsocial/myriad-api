import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {ExtendedPost} from '../interfaces';
import {Post, PostWithRelations} from '../models';
import {
  PeopleRepository,
  PostRepository,
  CommentRepository,
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

  async getDetailImporters(post: Post, friendIds: string[]) {
    const {count: totalImporter} = await this.postRepository.count({
      platform: post.platform as PlatformType,
      originPostId: post.originPostId,
    });

    friendIds.push(post.createdBy);

    friendIds = [...new Set(friendIds)];

    const posts = await this.postRepository.find({
      where: {
        platform: post.platform as PlatformType,
        originPostId: post.originPostId,
        or: friendIds.map(friendId => {
          return {
            createdBy: friendId,
          };
        }),
      },
      include: ['user'],
      limit: 5,
      order: ['updatedAt DESC'],
    });

    const postImporters = posts.map(e => e.user);

    return {
      totalImporter: totalImporter,
      importers: postImporters,
    };
  }
}

import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {ExtendedPost} from '../interfaces';
import {PostWithRelations} from '../models';
import {PeopleRepository, PostRepository} from '../repositories';
import {PolkadotJs} from '../utils/polkadotJs-utils';
import {injectable, BindingScope} from '@loopback/core';

@injectable({scope: BindingScope.TRANSIENT})
export class PostService {
  constructor(
    @repository(PostRepository)
    public postRepository: PostRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
  ) {}

  async createPost(post: Omit<ExtendedPost, 'id'>): Promise<PostWithRelations> {
    const {platformUser, platform} = post;
    const {getKeyring, getHexPublicKey} = new PolkadotJs();

    let people = await this.peopleRepository.findOne({
      where: {
        originUserId: platformUser?.originUserId,
        platform: platform,
      },
    });

    if (!people) {
      if (platformUser) {
        people = await this.peopleRepository.create(platformUser);

        const newKey = getKeyring().addFromUri('//' + people.id);

        this.peopleRepository.updateById(people.id, {
          walletAddress: getHexPublicKey(newKey),
        }) as Promise<void>;
      } else {
        throw new HttpErrors.NotFound('Platform user not found!');
      }
    }

    delete post.platformUser;
    post.peopleId = people.id;

    const newPost: PostWithRelations = await this.postRepository.create(post);
    newPost.people = people;
    return newPost;
  }
}

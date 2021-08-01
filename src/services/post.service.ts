import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {DefaultCryptocurrencyType} from '../enums';
import {PolkadotJs} from '../helpers/polkadotJs-utils';
import {ExtendedPost} from '../interfaces';
import {Post, PostTip, PublicMetric} from '../models';
import {PeopleRepository, PostRepository, PostTipRepository} from '../repositories';

export class PostService {
  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
    @repository(PostTipRepository)
    protected postTipRepository: PostTipRepository,
  ) {}

  async createPost(post: Omit<ExtendedPost, 'id'>): Promise<Post> {
    const {platformUser, platform} = post;
    const {getKeyring, getHexPublicKey} = new PolkadotJs();

    let people = await this.peopleRepository.findOne({
      where: {
        platformAccountId: platformUser?.platformAccountId,
        platform: platform,
      },
    });

    if (!people) {
      if (platformUser) people = await this.peopleRepository.create(platformUser);
      throw new HttpErrors.NotFound('Platform user not found!');
    }

    delete post.platformUser;
    post.peopleId = people.id;

    const newKey = getKeyring(process.env.MYRIAD_CRYPTO_TYPE).addFromUri('//' + post.peopleId);

    post.walletAddress = getHexPublicKey(newKey);

    const createdPost = await this.postRepository.create(post);

    this.postRepository.publicMetric(createdPost.id).create({}) as Promise<PublicMetric>;

    this.postRepository
      .postTips(createdPost.id)
      .create({cryptocurrencyId: DefaultCryptocurrencyType.AUSD}) as Promise<PostTip>;

    return createdPost;
  }
}

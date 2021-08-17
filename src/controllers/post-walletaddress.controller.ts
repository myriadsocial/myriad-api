import {repository} from '@loopback/repository';
import {get, getModelSchemaRef, HttpErrors, param, response} from '@loopback/rest';
import {PlatformType} from '../enums';
import {Wallet} from '../models';
import {PeopleRepository, PostRepository} from '../repositories';

export class PostWalletAddress {
  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
  ) {}

  @get('/posts/{id}/walletaddress')
  @response(200, {
    description: 'Post model wallet address',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Wallet),
      },
    },
  })
  async getWalletAddress(@param.path.string('id') id: string): Promise<Wallet> {
    const post = await this.postRepository.findById(id);

    const wallet = new Wallet();

    if (!post.peopleId) {
      if (post.platform === PlatformType.MYRIAD) {
        wallet.walletAddress = post.createdBy;

        return wallet;
      } else {
        throw new HttpErrors.NotFound('Walletaddress Not Found!');
      }
    }

    const people = await this.peopleRepository.findById(post.peopleId, {
      include: ['userSocialMedia'],
    });

    if (people.userSocialMedia) {
      wallet.walletAddress = people.userSocialMedia.userId;
    } else {
      if (!people.walletAddress) throw new HttpErrors.NotFound('Walletaddress Not Found!');

      wallet.walletAddress = people.walletAddress;
    }

    return wallet;
  }
}

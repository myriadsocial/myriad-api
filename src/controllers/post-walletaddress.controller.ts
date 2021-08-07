import {repository} from '@loopback/repository';
import {get, getModelSchemaRef, HttpErrors, param, response} from '@loopback/rest';
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
    const people = await this.peopleRepository.findById(post.peopleId, {
      include: ['userSocialMedia'],
    });

    const wallet = new Wallet();

    if (people.userSocialMedia) {
      wallet.walletAddress = people.userSocialMedia.userId;
    } else {
      if (!people.walletAddress) throw new HttpErrors.NotFound('Walletaddress Not Found!');

      wallet.walletAddress = people.walletAddress;
    }

    return wallet;
  }
}

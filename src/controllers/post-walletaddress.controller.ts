import {repository} from '@loopback/repository';
import {get, getModelSchemaRef, param, response} from '@loopback/rest';
import {Post, Wallet} from '../models';
import {PostRepository, UserCredentialRepository} from '../repositories';

export class PostWalletAddress {
  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(UserCredentialRepository)
    protected userCredentialRepository: UserCredentialRepository,
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
    const resultPost: Post = await this.postRepository.findById(id);
    const wallet = new Wallet({
      walletAddress: resultPost.walletAddress,
    });

    if (resultPost) {
      const resultUser = await this.userCredentialRepository.findOne({
        where: {
          peopleId: resultPost.peopleId,
        },
      });

      if (resultUser) {
        if (resultUser.isVerified) {
          wallet.walletAddress = resultUser.userId;
        }
      }
    }

    return wallet;
  }
}

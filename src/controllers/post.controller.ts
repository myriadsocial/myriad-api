import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where
} from '@loopback/repository';
import {
  del, get,
  getModelSchemaRef, 
  param,
  patch,
  post,
  put,
  requestBody,
  response
} from '@loopback/rest';
import {ApiPromise, Keyring, WsProvider} from '@polkadot/api';
import {Post} from '../models';
import {Wallet} from '../models/wallet.model';
import {PostRepository, UserCredentialRepository} from '../repositories';

export class PostController {
  constructor(
    @repository(PostRepository)
    public postRepository: PostRepository,
    @repository(UserCredentialRepository)
    public userCredentialRepository: UserCredentialRepository,
  ) { }

  @post('/posts')
  @response(200, {
    description: 'Post model instance',
    content: {'application/json': {schema: getModelSchemaRef(Post)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Post, {
            title: 'NewPost',
            exclude: ['id'],
          }),
        },
      },
    })
    post: Omit<Post, 'id'>
  ): Promise<Post> {
    return this.postRepository.create(post);
    
    // const result = await this.postRepository.create(post)
    // const wsProvider = new WsProvider('wss://rpc.myriad.systems')
    // const api = await ApiPromise.create({provider: wsProvider})
    // await api.isReady

    // const keyring = new Keyring({type: 'sr25519'});

    // const newKey = keyring.addFromUri('//' + result.id)

    // post.walletAddress = newKey.address
    // return result
  }

  // @get('/posts/count')
  // @response(200, {
  //   description: 'Post model count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async count(
  //   @param.where(Post) where?: Where<Post>,
  // ): Promise<Count> {
  //   return this.postRepository.count(where);
  // }

  @get('/posts')
  @response(200, {
    description: 'Array of Post model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Post, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Post) filter?: Filter<Post>,
  ): Promise<Post[]> {
    return this.postRepository.find(filter);
  }

  // @patch('/posts')
  // @response(200, {
  //   description: 'Post PATCH success count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async updateAll(
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(Post, {partial: true}),
  //       },
  //     },
  //   })
  //   post: Post,
  //   @param.where(Post) where?: Where<Post>,
  // ): Promise<Count> {
  //   return this.postRepository.updateAll(post, where);
  // }

  @get('/posts/{id}')
  @response(200, {
    description: 'Post model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Post, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Post, {exclude: 'where'}) filter?: FilterExcludingWhere<Post>
  ): Promise<Post> {
    return this.postRepository.findById(id, filter);
  }

  @get('/posts/{id}/walletaddress')
  @response(200, {
    description: 'Post model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Wallet),
      },
    },
  })
  async findByIdGetWalletAddress(
    @param.path.string('id') id: string
  ): Promise<Wallet> {
    const resultPost: Post = await this.postRepository.findById(id);

    console.log(resultPost)

    const wallet = new Wallet();
    wallet.walletAddress = resultPost.walletAddress != null
      ? resultPost.walletAddress : ''

    const resultUser = await this.userCredentialRepository.findOne({
      where: {
        peopleId: resultPost.peopleId
      }
    })

    console.log(resultUser)

    wallet.walletAddress = resultUser != null && resultUser.userId != null
      ? resultUser.userId : ''

    console.log(wallet)
    return wallet;
  }

  @patch('/posts/{id}')
  @response(204, {
    description: 'Post PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Post, {partial: true}),
        },
      },
    })
    post: Post,
  ): Promise<void> {
    await this.postRepository.updateById(id, post);
  }

  // @put('/posts/{id}')
  // @response(204, {
  //   description: 'Post PUT success',
  // })
  // async replaceById(
  //   @param.path.string('id') id: string,
  //   @requestBody() post: Post,
  // ): Promise<void> {
  //   await this.postRepository.replaceById(id, post);
  // }

  @del('/posts/{id}')
  @response(204, {
    description: 'Post DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.postRepository.deleteById(id);
  }
}

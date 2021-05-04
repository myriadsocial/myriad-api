import {
  Filter,
  FilterExcludingWhere,
  repository
} from '@loopback/repository';
import {
  del, get,
  getModelSchemaRef,
  param,
  patch,
  post,
  requestBody,
  response
} from '@loopback/rest';
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
    post: Omit<Post, 'id'>,
  ): Promise<Post> {
    return this.postRepository.create({
      ...post,
      platformCreatedAt: new Date().toString(),
      createdAt: new Date().toString(),
      updatedAt: new Date().toString()
    });
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

  @get('/posts/liked')
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
  async findMostLiked(
    @param.query.string("sort") sort: string
  ): Promise<Post[]> {
    const posts = await this.postRepository.find({include: ["publicMetric"]});

    posts.sort((a, b) => {
      const likeA = a.publicMetric.liked
      const likeB = b.publicMetric.liked

      if (likeA < likeB) {
        return 1
      }

      if (likeA > likeB) {
        return -1
      }

      return 0
    })

    switch(sort) {
      case 'asc':
        posts.sort((a, b) => {
          const likeA = a.publicMetric.liked
          const likeB = b.publicMetric.liked

          if (likeA < likeB) {
            return -1
          }

          if (likeA > likeB) {
            return 1
          }

          return 0
        })

        return posts

      case 'desc':
        return posts

      default:
        return posts
    }
  }

  @get('/posts/comments')
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
  async findMostComments(
    @param.query.string("sort") sort: string
  ): Promise<Post[]> {
    const posts = await this.postRepository.find({include: ["publicMetric"]});

    posts.sort((a, b) => {
      const commentA = a.publicMetric.comment
      const commentB = b.publicMetric.comment

      if (commentA < commentB) {
        return 1
      }

      if (commentA > commentB) {
        return -1
      }

      return 0
    })

    switch(sort) {
      case 'asc':
        posts.sort((a, b) => {
          const commentA = a.publicMetric.comment
          const commentB = b.publicMetric.comment

          if (commentA < commentB) {
            return -1
          }

          if (commentA > commentB) {
            return 1
          }

          return 0
        })

        return posts

      case 'desc':
        return posts

      default:
        return posts
    }
  }

  @get('/posts/dates')
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
  async findNewestDate(
    @param.query.string("sort") sort: string
  ): Promise<Post[]> {
    const posts = await this.postRepository.find();

    posts.sort((a,b) => {
      const dateA = a.platformCreatedAt
      const dateB = b.platformCreatedAt

      if (dateA < dateB) {
        return 1
      }

      if (dateA > dateB) {
        return -1
      }

      return 0
    })

    switch(sort) {
      case "asc":
        posts.sort((a, b) => {
          const dateA = a.platformCreatedAt
          const dateB = b.platformCreatedAt

          if (dateA < dateB) {
            return -1
          }

          if (dateA > dateB) {
            return 1
          }

          return 0
        })

        return posts

      case "desc":
        return posts

      default:
        return posts
    }
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
    const resultPost: Post = await this.postRepository.findById(id)

    const wallet = new Wallet()
    if (resultPost != null) {
      wallet.walletAddress = resultPost.walletAddress != null
        ? resultPost.walletAddress : ''

      const resultUser = await this.userCredentialRepository.findOne({
        where: {
          peopleId: resultPost.peopleId
        }
      })

      if (resultUser != null) {
        wallet.walletAddress = resultUser.userId != null
          ? resultUser.userId : ''
      }
    }

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
    await this.postRepository.updateById(id, {
      ...post,
      updatedAt: new Date().toString()
    });
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

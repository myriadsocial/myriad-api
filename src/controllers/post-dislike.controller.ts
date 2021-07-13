import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  post,
  requestBody
} from '@loopback/rest';
import {Dislike, Post} from '../models';
import {
  DislikeRepository,
  LikeRepository,
  PostRepository
} from '../repositories';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class PostDislikeController {
  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(DislikeRepository)
    protected dislikeRepository: DislikeRepository,
    @repository(LikeRepository)
    protected likeRepository: LikeRepository
  ) { }

  @get('/posts/{id}/dislikes', {
    responses: {
      '200': {
        description: 'Array of Post has many Dislike',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Dislike)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Dislike>,
  ): Promise<Dislike[]> {
    return this.postRepository.dislikes(id).find(filter);
  }

  @post('/posts/{id}/dislikes', {
    responses: {
      '200': {
        description: 'Post model instance',
        content: {'application/json': {schema: getModelSchemaRef(Dislike)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Post.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Dislike, {
            title: 'NewDislikeInPost',
            exclude: ['id'],
            optional: ['postId']
          }),
        },
      },
    }) dislike: Omit<Dislike, 'id'>,
  ): Promise<Dislike> {
    const foundDislike = await this.dislikeRepository.findOne({
      where: {
        postId: id,
        userId: dislike.userId
      }
    })

    const foundLike = await this.likeRepository.findOne({
      where: {
        postId: id,
        userId: dislike.userId
      }
    })

    if (!foundDislike) {
      const newDislike = await this.postRepository.dislikes(id).create({
        ...dislike,
        status: true
      })

      if (foundLike && foundLike.status) {
        await this.likeRepository.updateById(foundLike.id, {status: false})
      }

      this.countDislike(id)

      return newDislike
    }

    if (foundDislike.status === false) {
      await this.dislikeRepository.updateById(foundDislike.id, {status: true})

      if (foundLike && foundLike.status) {
        await this.likeRepository.updateById(foundLike.id, {status: false})
      }
    } else {
      await this.dislikeRepository.updateById(foundDislike.id, {status: false})
    }

    this.countDislike(id)

    foundDislike.status = !foundDislike.status

    return foundDislike
  }

  @patch('/posts/{id}/dislikes', {
    responses: {
      '200': {
        description: 'Post.Dislike PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Dislike, {partial: true}),
        },
      },
    })
    dislike: Partial<Dislike>,
    @param.query.object('where', getWhereSchemaFor(Dislike)) where?: Where<Dislike>,
  ): Promise<Count> {
    return this.postRepository.dislikes(id).patch(dislike, where);
  }

  @del('/posts/{id}/dislikes', {
    responses: {
      '200': {
        description: 'Post.Dislike DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Dislike)) where?: Where<Dislike>,
  ): Promise<Count> {
    return this.postRepository.dislikes(id).delete(where);
  }

  async countDislike(postId: any): Promise<void> {
    const dislikes = await this.dislikeRepository.count({
      postId,
      status: true
    })

    const likes = await this.likeRepository.count({
      postId,
      status: true
    })

    this.postRepository.publicMetric(postId).patch({
      disliked: dislikes.count,
      liked: likes.count
    })

    this.postRepository.updateById(postId, {
      totalDisliked: dislikes.count,
      totalLiked: likes.count
    })
  }
}

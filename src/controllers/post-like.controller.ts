import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import {
  Post,
  Like,
} from '../models';
import {
  LikeRepository, 
  PostRepository,
  DislikeRepository
} from '../repositories';

export class PostLikeController {
  constructor(
    @repository(PostRepository) protected postRepository: PostRepository,
    @repository(LikeRepository) protected likeRepository: LikeRepository,
    @repository(DislikeRepository) protected dislikeRepository: DislikeRepository
  ) { }

  @get('/posts/{id}/likes', {
    responses: {
      '200': {
        description: 'Array of Post has many Like',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Like)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Like>,
  ): Promise<Like[]> {
    return this.postRepository.likes(id).find(filter);
  }

  @post('/posts/{id}/likes', {
    responses: {
      '200': {
        description: 'Post model instance',
        content: {'application/json': {schema: getModelSchemaRef(Like)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Post.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Like, {
            title: 'NewLikeInPost',
            exclude: ['id'],
            optional: ['postId']
          }),
        },
      },
    }) like: Omit<Like, 'id'>,
  ): Promise<Like> {
    const foundLike = await this.likeRepository.findOne({
      where: {
        postId: id, 
        userId: like.userId
      }
    })

    const foundDislike = await this.dislikeRepository.findOne({
      where: {
        postId: id,
        userId: like.userId
      }
    })

    if (!foundLike) {
      const newLike = await this.postRepository.likes(id).create({
        ...like,
        status: true
      });

      if (foundDislike && foundDislike.status) {
        await this.dislikeRepository.updateById(foundDislike.id, {status: false})
      }

      await this.countLike(id)
      
      return newLike
    }

    if (!foundLike.status) {
      await this.likeRepository.updateById(foundLike.id, {status: true})

      if (foundDislike && foundDislike.status) {
        await this.dislikeRepository.updateById(foundDislike.id, {status: false})
      }
    } else {
      await this.likeRepository.updateById(foundLike.id, {status: false})
    }

    await this.countLike(id)
    
    foundLike.status = !foundLike.status

    return foundLike
  }

  @patch('/posts/{id}/likes', {
    responses: {
      '200': {
        description: 'Post.Like PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Like, {partial: true}),
        },
      },
    })
    like: Partial<Like>,
    @param.query.object('where', getWhereSchemaFor(Like)) where?: Where<Like>,
  ): Promise<Count> {
    return this.postRepository.likes(id).patch(like, where);
  }

  @del('/posts/{id}/likes', {
    responses: {
      '200': {
        description: 'Post.Like DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Like)) where?: Where<Like>,
  ): Promise<Count> {
    return this.postRepository.likes(id).delete(where);
  }

  async countLike (postId:any):Promise<void> {
    const likes = await this.likeRepository.find({
      where: {
        postId
      }
    })

    const dislikes = await this.dislikeRepository.find({
      where: {
        postId
      }
    })
    
    await this.postRepository.publicMetric(postId).patch({
      liked: likes.filter(like => like.status).length,
      disliked: dislikes.filter(dislike => dislike.status).length
    })
  }
}

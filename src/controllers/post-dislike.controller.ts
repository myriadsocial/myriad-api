import {service} from '@loopback/core';
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
import {Dislike, Post, Like} from '../models';
import {DislikeRepository, PostRepository} from '../repositories';
import {MetricService} from '../services';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class PostDislikeController {
  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(DislikeRepository)
    protected dislikeRepository: DislikeRepository,
    @service(MetricService)
    protected metricService: MetricService,
  ) {}

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
          schema: {
            type: 'object',
            properties: {
              userId: {
                type: 'string',
              },
            },
          },
        },
      },
    })
    dislike: Omit<Dislike, 'id'>,
  ): Promise<Like | Dislike> {
    // TODO: Move logic to service
    return this.metricService.likeDislikeSystem(
      {
        userId: dislike.userId,
        postId: id,
      },
      false,
    );
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
    @param.query.object('where', getWhereSchemaFor(Dislike))
    where?: Where<Dislike>,
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
    @param.query.object('where', getWhereSchemaFor(Dislike))
    where?: Where<Dislike>,
  ): Promise<Count> {
    return this.postRepository.dislikes(id).delete(where);
  }
}

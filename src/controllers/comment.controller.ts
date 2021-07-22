import {Filter, FilterExcludingWhere, repository} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  requestBody,
  response,
} from '@loopback/rest';
import {Comment, Post, User} from '../models';
import {CommentRepository} from '../repositories';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class CommentController {
  constructor(
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
  ) {}

  // TODO: Remove endpoint POST /comments
  // TODO: Move the endpoint to post-comment.controller.ts
  // TODO: Change POST /comments to POST /posts/{id}/comments
  @get('/comments')
  @response(200, {
    description: 'Array of Comment model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Comment, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Comment) filter?: Filter<Comment>,
  ): Promise<Comment[]> {
    return this.commentRepository.find(filter);
  }

  @get('/comments/{id}')
  @response(200, {
    description: 'Comment model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Comment, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Comment, {exclude: 'where'})
    filter?: FilterExcludingWhere<Comment>,
  ): Promise<Comment> {
    return this.commentRepository.findById(id, filter);
  }

  @get('/comments/{id}/user', {
    responses: {
      '200': {
        description: 'User belonging to Comment',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(User)},
          },
        },
      },
    },
  })
  async getUser(
    @param.path.string('id') id: typeof Comment.prototype.id,
  ): Promise<User> {
    return this.commentRepository.user(id);
  }

  @get('/comments/{id}/post', {
    responses: {
      '200': {
        description: 'Post belonging to Comment',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Post)},
          },
        },
      },
    },
  })
  async getPost(
    @param.path.string('id') id: typeof Comment.prototype.id,
  ): Promise<Post> {
    return this.commentRepository.post(id);
  }

  @patch('/comments/{id}')
  @response(204, {
    description: 'Comment PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Comment, {partial: true}),
        },
      },
    })
    comment: Comment,
  ): Promise<void> {
    comment.updatedAt = new Date().toString();
    await this.commentRepository.updateById(id, comment);
  }

  @del('/comments/{id}')
  @response(204, {
    description: 'Comment DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.commentRepository.deleteById(id);
  }
}

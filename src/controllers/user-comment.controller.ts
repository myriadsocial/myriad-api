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
import {Comment, User} from '../models';
import {
  CommentRepository,
  ConversationRepository,
  PostRepository,
  UserRepository
} from '../repositories';
// import {authenticate} from '@loopback/authentication';

// @authenticate("jwt")
export class UserCommentController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(ConversationRepository)
    protected conversationRepository: ConversationRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(CommentRepository)
    protected commentRepository: CommentRepository
  ) { }

  @get('/users/{id}/comments', {
    responses: {
      '200': {
        description: 'Array of User has many Comment',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Comment)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Comment>,
  ): Promise<Comment[]> {
    return this.userRepository.comments(id).find(filter);
  }

  @post('/users/{id}/comments', {
    responses: {
      '200': {
        description: 'User model instance',
        content: {'application/json': {schema: getModelSchemaRef(Comment)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof User.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Comment, {
            title: 'NewCommentInUser',
            exclude: ['id'],
            optional: ['userId']
          }),
        },
      },
    }) comment: Omit<Comment, 'id'>,
  ): Promise<Comment> {
    const foundConversation = await this.conversationRepository.findOne({
      where: {
        userId: id,
        postId: comment.postId
      }
    })

    if (!foundConversation) {
      this.conversationRepository.create({
        userId: id,
        postId: comment.postId,
        createdAt: new Date().toString(),
        updatedAt: new Date().toString()
      })
    } else {
      this.conversationRepository.updateById(foundConversation.id, {
        read: true,
        unreadMessage: 0,
        updatedAt: new Date().toString()
      })
    }

    this.conversationRepository.updateAll({
      read: false,
      updatedAt: new Date().toString()
    }, {
      postId: comment.postId,
      read: true,
      userId: {
        neq: id
      }
    })

    const newComment = await this.userRepository.comments(id).create({
      ...comment,
      createdAt: new Date().toString(),
      updatedAt: new Date().toString()
    });

    const totalComment = await this.commentRepository.count({
      postId: comment.postId
    })

    this.postRepository.publicMetric(comment.postId).patch({comment: totalComment.count})
    this.postRepository.updateById(comment.postId, {totalComment: totalComment.count})

    const foundAllConversation = await this.conversationRepository.find({
      where: {
        postId: comment.postId,
        read: false,
        userId: {
          neq: id
        }
      }
    })

    for (let i = 0; i < foundAllConversation.length; i++) {
      const id = foundAllConversation[i].id
      const latestDate = foundAllConversation[i].updatedAt
      const postId = foundAllConversation[i].postId

      const allComment = await this.commentRepository.count({
        postId,
        createdAt: {
          gte: latestDate
        }
      })

      await this.conversationRepository.updateById(id, {
        unreadMessage: allComment.count
      })
    }

    return newComment
  }

  @patch('/users/{id}/comments', {
    responses: {
      '200': {
        description: 'User.Comment PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Comment, {partial: true}),
        },
      },
    })
    comment: Partial<Comment>,
    @param.query.object('where', getWhereSchemaFor(Comment)) where?: Where<Comment>,
  ): Promise<Count> {
    return this.userRepository.comments(id).patch(comment, where);
  }

  @del('/users/{id}/comments', {
    responses: {
      '200': {
        description: 'User.Comment DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Comment)) where?: Where<Comment>,
  ): Promise<Count> {
    return this.userRepository.comments(id).delete(where);
  }
}

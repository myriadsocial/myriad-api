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
import {Comment, Post} from '../models';
import {
  CommentRepository,
  ConversationRepository,
  PostRepository
} from '../repositories';
import {authenticate} from '@loopback/authentication';

@authenticate("jwt")
export class PostCommentController {
  constructor(
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(CommentRepository)
    protected commentRepository: CommentRepository,
    @repository(ConversationRepository)
    protected conversationRepository: ConversationRepository
  ) { }

  @get('/posts/{id}/comments', {
    responses: {
      '200': {
        description: 'Array of Post has many Comment',
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
    return this.postRepository.comments(id).find(filter);
  }

  @post('/posts/{id}/comments', {
    responses: {
      '200': {
        description: 'Post model instance',
        content: {'application/json': {schema: getModelSchemaRef(Comment)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Post.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Comment, {
            title: 'NewCommentInPost',
            exclude: ['id'],
            optional: ['postId']
          }),
        },
      },
    }) comment: Omit<Comment, 'id'>,
  ): Promise<Comment> {
    const foundConversation = await this.conversationRepository.findOne({
      where: {
        userId: comment.userId,
        postId: id
      }
    })

    if (!foundConversation) {
      this.conversationRepository.create({
        userId: comment.userId,
        postId: id,
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
      postId: id,
      read: true,
      userId: {
        neq: comment.userId
      }
    })

    const newComment = await this.postRepository.comments(id).create({
      ...comment,
      createdAt: new Date().toString(),
      updatedAt: new Date().toString()
    });

    const totalComment = await this.commentRepository.count({
      postId: id
    })

    this.postRepository.publicMetric(id).patch({comment: totalComment.count})
    this.postRepository.updateById(id, {totalComment: totalComment.count})


    const totalConversation = await this.conversationRepository.count({
      postId: id,
      read: false,
      userId: {
        neq: comment.userId
      }
    })

    for (let i = 0; i < totalConversation.count; i++) {
      const conversation = (await this.conversationRepository.find({
        where: {
          postId: id,
          read: false,
          userId: {
            neq: comment.userId
          }
        },
        limit: 1,
        skip: i
      }))[0]

      const conversationId = conversation.id;
      const latestDate = conversation.updatedAt;
      const postId = conversation.postId;

      const allComment = await this.commentRepository.count({
        postId,
        createdAt: {
          gte: latestDate
        }
      })

      await this.conversationRepository.updateById(conversationId, {
        unreadMessage: allComment.count
      })
    }

    return newComment
  }

  @patch('/posts/{id}/comments', {
    responses: {
      '200': {
        description: 'Post.Comment PATCH success count',
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
    return this.postRepository.comments(id).patch({
      ...comment,
      updatedAt: new Date().toString()
    }, where);
  }

  @del('/posts/{id}/comments', {
    responses: {
      '200': {
        description: 'Post.Comment DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Comment)) where?: Where<Comment>,
  ): Promise<Count> {
    return this.postRepository.comments(id).delete(where);
  }
}

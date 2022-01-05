import {intercept} from '@loopback/context';
import {param, response, get, getModelSchemaRef} from '@loopback/rest';
import {AnyObject, repository} from '@loopback/repository';
import {PaginationInterceptor} from '../interceptors';
import {Comment, Post, User} from '../models';
import {Filter} from '@loopback/repository';
import {
  CommentRepository,
  PostRepository,
  ReportRepository,
  UserRepository,
} from '../repositories';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
export class DeletedCollectionController {
  constructor(
    @repository(UserRepository)
    public userRepository: UserRepository,
    @repository(PostRepository)
    public postRepository: PostRepository,
    @repository(CommentRepository)
    public commentRepository: CommentRepository,
    @repository(ReportRepository)
    public reportRepository: ReportRepository,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/posts/deleted')
  async deletedPostList(
    @param.filter(Post, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<Post>,
  ): Promise<Post[]> {
    return this.postRepository.find(this.updatedFilter(filter) as Filter<Post>);
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @logInvocation()
  @get('/comments/deleted')
  async deletedCommentList(
    @param.filter(Comment, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<Comment>,
  ): Promise<Comment[]> {
    return this.commentRepository.find(
      this.updatedFilter(filter) as Filter<Comment>,
    );
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/users/deleted')
  @response(200, {
    description: 'Array of Deleted User model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(User, {includeRelations: true}),
        },
      },
    },
  })
  async deletedUserList(
    @param.filter(User, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<User>,
  ): Promise<User[]> {
    return this.userRepository.find(filter);
  }

  @get('/users/{id}/deleted')
  @response(200, {
    description: 'Deleted User model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(User, {includeRelations: true}),
      },
    },
  })
  async findDeletedUserById(
    @param.path.string('id') id: string,
    @param.filter(User, {exclude: 'where'}) filter?: FilterExcludingWhere<User>,
  ): Promise<User> {
    return this.userRepository.findById(id, filter);
  }

  @patch('/users/{id}/recover')
  @response(204, {
    description: 'User RECOVER success',
  })
  async recoverUser(@param.path.string('id') id: string): Promise<void> {
    await this.userRepository.updateById(id, <any>{
      $unset: {
        deletedAt: '',
      },
    });

    return Object.assign(filter ?? {}, {where});
  }
}

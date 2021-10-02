import {intercept} from '@loopback/context';
import {del, param, response, patch, get} from '@loopback/rest';
import {repository} from '@loopback/repository';
import {ReferenceType, ReportStatusType} from '../enums';
import {PaginationInterceptor} from '../interceptors';
import {Post, User} from '../models';
import {Filter} from '@loopback/repository';
import {
  PostRepository,
  ReportRepository,
  UserRepository,
} from '../repositories';

/* eslint-disable  @typescript-eslint/no-explicit-any */
export class DeletedCollectionController {
  constructor(
    @repository(UserRepository)
    public userRepository: UserRepository,
    @repository(PostRepository)
    public postRepository: PostRepository,
    @repository(ReportRepository)
    public reportRepository: ReportRepository,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/posts/deleted-list')
  async deletedPostList(
    @param.filter(Post, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<Post>,
  ): Promise<Post[]> {
    return this.postRepository.find(filter);
  }

  @patch('/posts/{id}/recover')
  @response(204, {
    description: 'Post RECOVER success',
  })
  async recoverPost(@param.path.string('id') id: string): Promise<void> {
    await this.postRepository.updateById(id, <any>{
      $unset: {
        deletedAt: '',
      },
    });
  }

  @del('/posts/{id}/delete')
  @response(204, {
    description: 'Post DELETE success',
  })
  async deletePostById(@param.path.string('id') id: string): Promise<void> {
    await this.postRepository.updateById(id, {
      deletedAt: new Date().toString(),
    });
    await this.reportRepository.updateAll(
      {status: ReportStatusType.APPROVED},
      {referenceId: id, referenceType: ReferenceType.POST},
    );
  }

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/users/deleted-list')
  async deletedUserList(
    @param.filter(User, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<User>,
  ): Promise<User[]> {
    return this.userRepository.find(filter);
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
  }

  @del('/users/{id}/delete')
  @response(204, {
    description: 'User DELETE success',
  })
  async deleteUserById(@param.path.string('id') id: string): Promise<void> {
    await this.userRepository.updateById(id, {
      deletedAt: new Date().toString(),
    });
    await this.reportRepository.updateAll(
      {status: ReportStatusType.APPROVED},
      {referenceId: id, referenceType: ReferenceType.USER},
    );
  }
}

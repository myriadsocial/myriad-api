import {intercept} from '@loopback/context';
import {
  del,
  param,
  response,
  patch,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {repository} from '@loopback/repository';
import {ReferenceType, ReportStatusType} from '../enums';
import {PaginationInterceptor} from '../interceptors';
import {Post, User} from '../models';
import {Filter, FilterExcludingWhere} from '@loopback/repository';
import {
  PostRepository,
  ReportRepository,
  UserRepository,
} from '../repositories';
import {service} from '@loopback/core';
import {NotificationService} from '../services';

/* eslint-disable  @typescript-eslint/no-explicit-any */
export class DeletedCollectionController {
  constructor(
    @repository(UserRepository)
    public userRepository: UserRepository,
    @repository(PostRepository)
    public postRepository: PostRepository,
    @repository(ReportRepository)
    public reportRepository: ReportRepository,
    @service(NotificationService)
    public notificationService: NotificationService,
  ) {}

  @intercept(PaginationInterceptor.BINDING_KEY)
  @get('/posts/deleted')
  async deletedPostList(
    @param.filter(Post, {exclude: ['limit', 'skip', 'offset']})
    filter?: Filter<Post>,
  ): Promise<Post[]> {
    return this.postRepository.find(filter);
  }

  @get('/posts/{id}/deleted')
  @response(200, {
    description: 'Deleted Post model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Post, {includeRelations: true}),
      },
    },
  })
  async findDeletedPostById(
    @param.path.string('id') id: string,
    @param.filter(Post, {exclude: 'where'}) filter?: FilterExcludingWhere<Post>,
  ): Promise<Post> {
    return this.postRepository.findById(id, filter);
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
    try {
      await this.notificationService.sendUpdateReport(id, ReferenceType.POST);
    } catch {
      // ignore
    }
    await this.postRepository.updateById(id, {
      deletedAt: new Date().toString(),
    });
    await this.reportRepository.updateAll(
      {status: ReportStatusType.REMOVED},
      {referenceId: id, referenceType: ReferenceType.POST},
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
  }

  @del('/users/{id}/delete')
  @response(204, {
    description: 'User DELETE success',
  })
  async deleteUserById(@param.path.string('id') id: string): Promise<void> {
    try {
      await this.notificationService.sendUpdateReport(id, ReferenceType.USER);
    } catch {
      // ignore
    }
    await this.userRepository.updateById(id, {
      deletedAt: new Date().toString(),
    });
    await this.reportRepository.updateAll(
      {status: ReportStatusType.REMOVED},
      {referenceId: id, referenceType: ReferenceType.USER},
    );
  }
}

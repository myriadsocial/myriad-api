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
  PublicMetric,
} from '../models';
import {PostRepository} from '../repositories';

export class PostPublicMetricController {
  // constructor(
  //   @repository(PostRepository) protected postRepository: PostRepository,
  // ) { }

  // @get('/posts/{id}/public-metric', {
  //   responses: {
  //     '200': {
  //       description: 'Post has one PublicMetric',
  //       content: {
  //         'application/json': {
  //           schema: getModelSchemaRef(PublicMetric),
  //         },
  //       },
  //     },
  //   },
  // })
  // async get(
  //   @param.path.string('id') id: string,
  //   @param.query.object('filter') filter?: Filter<PublicMetric>,
  // ): Promise<PublicMetric> {
  //   return this.postRepository.publicMetric(id).get(filter);
  // }

  // @post('/posts/{id}/public-metric', {
  //   responses: {
  //     '200': {
  //       description: 'Post model instance',
  //       content: {'application/json': {schema: getModelSchemaRef(PublicMetric)}},
  //     },
  //   },
  // })
  // async create(
  //   @param.path.string('id') id: typeof Post.prototype.id,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(PublicMetric, {
  //           title: 'NewPublicMetricInPost',
  //           exclude: ['id'],
  //           optional: ['postId']
  //         }),
  //       },
  //     },
  //   }) publicMetric: Omit<PublicMetric, 'id'>,
  // ): Promise<PublicMetric> {
  //   return this.postRepository.publicMetric(id).create(publicMetric);
  // }

  // @patch('/posts/{id}/public-metric', {
  //   responses: {
  //     '200': {
  //       description: 'Post.PublicMetric PATCH success count',
  //       content: {'application/json': {schema: CountSchema}},
  //     },
  //   },
  // })
  // async patch(
  //   @param.path.string('id') id: string,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(PublicMetric, {partial: true}),
  //       },
  //     },
  //   })
  //   publicMetric: Partial<PublicMetric>,
  //   @param.query.object('where', getWhereSchemaFor(PublicMetric)) where?: Where<PublicMetric>,
  // ): Promise<Count> {
  //   return this.postRepository.publicMetric(id).patch(publicMetric, where);
  // }

  // @del('/posts/{id}/public-metric', {
  //   responses: {
  //     '200': {
  //       description: 'Post.PublicMetric DELETE success count',
  //       content: {'application/json': {schema: CountSchema}},
  //     },
  //   },
  // })
  // async delete(
  //   @param.path.string('id') id: string,
  //   @param.query.object('where', getWhereSchemaFor(PublicMetric)) where?: Where<PublicMetric>,
  // ): Promise<Count> {
  //   return this.postRepository.publicMetric(id).delete(where);
  // }
}

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
  Asset,
} from '../models';
import {PostRepository} from '../repositories';

export class PostAssetController {
  // constructor(
  //   @repository(PostRepository) protected postRepository: PostRepository,
  // ) { }

  // @get('/posts/{id}/asset', {
  //   responses: {
  //     '200': {
  //       description: 'Post has one Asset',
  //       content: {
  //         'application/json': {
  //           schema: getModelSchemaRef(Asset),
  //         },
  //       },
  //     },
  //   },
  // })
  // async get(
  //   @param.path.string('id') id: string,
  //   @param.query.object('filter') filter?: Filter<Asset>,
  // ): Promise<Asset> {
  //   return this.postRepository.asset(id).get(filter);
  // }

  // @post('/posts/{id}/asset', {
  //   responses: {
  //     '200': {
  //       description: 'Post model instance',
  //       content: {'application/json': {schema: getModelSchemaRef(Asset)}},
  //     },
  //   },
  // })
  // async create(
  //   @param.path.string('id') id: typeof Post.prototype.id,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(Asset, {
  //           title: 'NewAssetInPost',
  //           exclude: ['id'],
  //           optional: ['postId']
  //         }),
  //       },
  //     },
  //   }) asset: Omit<Asset, 'id'>,
  // ): Promise<Asset> {
  //   return this.postRepository.asset(id).create(asset);
  // }

  // @patch('/posts/{id}/asset', {
  //   responses: {
  //     '200': {
  //       description: 'Post.Asset PATCH success count',
  //       content: {'application/json': {schema: CountSchema}},
  //     },
  //   },
  // })
  // async patch(
  //   @param.path.string('id') id: string,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(Asset, {partial: true}),
  //       },
  //     },
  //   })
  //   asset: Partial<Asset>,
  //   @param.query.object('where', getWhereSchemaFor(Asset)) where?: Where<Asset>,
  // ): Promise<Count> {
  //   return this.postRepository.asset(id).patch(asset, where);
  // }

  // @del('/posts/{id}/asset', {
  //   responses: {
  //     '200': {
  //       description: 'Post.Asset DELETE success count',
  //       content: {'application/json': {schema: CountSchema}},
  //     },
  //   },
  // })
  // async delete(
  //   @param.path.string('id') id: string,
  //   @param.query.object('where', getWhereSchemaFor(Asset)) where?: Where<Asset>,
  // ): Promise<Count> {
  //   return this.postRepository.asset(id).delete(where);
  // }
}

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
  User,
  Like,
} from '../models';
import {UserRepository} from '../repositories';

export class UserLikeController {
  // constructor(
  //   @repository(UserRepository) protected userRepository: UserRepository,
  // ) { }

  // @get('/users/{id}/likes', {
  //   responses: {
  //     '200': {
  //       description: 'Array of User has many Like',
  //       content: {
  //         'application/json': {
  //           schema: {type: 'array', items: getModelSchemaRef(Like)},
  //         },
  //       },
  //     },
  //   },
  // })
  // async find(
  //   @param.path.string('id') id: string,
  //   @param.query.object('filter') filter?: Filter<Like>,
  // ): Promise<Like[]> {
  //   return this.userRepository.likes(id).find(filter);
  // }

  // @post('/users/{id}/likes', {
  //   responses: {
  //     '200': {
  //       description: 'User model instance',
  //       content: {'application/json': {schema: getModelSchemaRef(Like)}},
  //     },
  //   },
  // })
  // async create(
  //   @param.path.string('id') id: typeof User.prototype.id,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(Like, {
  //           title: 'NewLikeInUser',
  //           exclude: ['id'],
  //           optional: ['userId']
  //         }),
  //       },
  //     },
  //   }) like: Omit<Like, 'id'>,
  // ): Promise<Like> {
  //   return this.userRepository.likes(id).create(like);
  // }

  // @patch('/users/{id}/likes', {
  //   responses: {
  //     '200': {
  //       description: 'User.Like PATCH success count',
  //       content: {'application/json': {schema: CountSchema}},
  //     },
  //   },
  // })
  // async patch(
  //   @param.path.string('id') id: string,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(Like, {partial: true}),
  //       },
  //     },
  //   })
  //   like: Partial<Like>,
  //   @param.query.object('where', getWhereSchemaFor(Like)) where?: Where<Like>,
  // ): Promise<Count> {
  //   return this.userRepository.likes(id).patch(like, where);
  // }

  // @del('/users/{id}/likes', {
  //   responses: {
  //     '200': {
  //       description: 'User.Like DELETE success count',
  //       content: {'application/json': {schema: CountSchema}},
  //     },
  //   },
  // })
  // async delete(
  //   @param.path.string('id') id: string,
  //   @param.query.object('where', getWhereSchemaFor(Like)) where?: Where<Like>,
  // ): Promise<Count> {
  //   return this.userRepository.likes(id).delete(where);
  // }
}

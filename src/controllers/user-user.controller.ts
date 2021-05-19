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
Friend,
} from '../models';
import {UserRepository} from '../repositories';

export class UserUserController {
  // constructor(
  //   @repository(UserRepository) protected userRepository: UserRepository,
  // ) { }

  // @get('/users/{id}/users', {
  //   responses: {
  //     '200': {
  //       description: 'Array of User has many User through Friend',
  //       content: {
  //         'application/json': {
  //           schema: {type: 'array', items: getModelSchemaRef(User)},
  //         },
  //       },
  //     },
  //   },
  // })
  // async find(
  //   @param.path.string('id') id: string,
  //   @param.query.object('filter') filter?: Filter<User>,
  // ): Promise<User[]> {
  //   return this.userRepository.friends(id).find(filter);
  // }

  // @post('/users/{id}/users', {
  //   responses: {
  //     '200': {
  //       description: 'create a User model instance',
  //       content: {'application/json': {schema: getModelSchemaRef(User)}},
  //     },
  //   },
  // })
  // async create(
  //   @param.path.string('id') id: typeof User.prototype.id,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(User, {
  //           title: 'NewUserInUser',
  //           exclude: ['id'],
  //         }),
  //       },
  //     },
  //   }) user: Omit<User, 'id'>,
  // ): Promise<User> {
  //   return this.userRepository.friends(id).create(user);
  // }

  // @patch('/users/{id}/users', {
  //   responses: {
  //     '200': {
  //       description: 'User.User PATCH success count',
  //       content: {'application/json': {schema: CountSchema}},
  //     },
  //   },
  // })
  // async patch(
  //   @param.path.string('id') id: string,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(User, {partial: true}),
  //       },
  //     },
  //   })
  //   user: Partial<User>,
  //   @param.query.object('where', getWhereSchemaFor(User)) where?: Where<User>,
  // ): Promise<Count> {
  //   return this.userRepository.friends(id).patch(user, where);
  // }

  // @del('/users/{id}/users', {
  //   responses: {
  //     '200': {
  //       description: 'User.User DELETE success count',
  //       content: {'application/json': {schema: CountSchema}},
  //     },
  //   },
  // })
  // async delete(
  //   @param.path.string('id') id: string,
  //   @param.query.object('where', getWhereSchemaFor(User)) where?: Where<User>,
  // ): Promise<Count> {
  //   return this.userRepository.friends(id).delete(where);
  // }
}

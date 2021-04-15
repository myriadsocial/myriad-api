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
  People,
  UserCredential,
} from '../models';
import {PeopleRepository} from '../repositories';

export class PeopleUserCredentialController {
  // constructor(
  //   @repository(PeopleRepository) protected peopleRepository: PeopleRepository,
  // ) { }

  // @get('/people/{id}/user-credential', {
  //   responses: {
  //     '200': {
  //       description: 'People has one UserCredential',
  //       content: {
  //         'application/json': {
  //           schema: getModelSchemaRef(UserCredential),
  //         },
  //       },
  //     },
  //   },
  // })
  // async get(
  //   @param.path.string('id') id: string,
  //   @param.query.object('filter') filter?: Filter<UserCredential>,
  // ): Promise<UserCredential> {
  //   return this.peopleRepository.userCredential(id).get(filter);
  // }

  // @post('/people/{id}/user-credential', {
  //   responses: {
  //     '200': {
  //       description: 'People model instance',
  //       content: {'application/json': {schema: getModelSchemaRef(UserCredential)}},
  //     },
  //   },
  // })
  // async create(
  //   @param.path.string('id') id: typeof People.prototype.id,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(UserCredential, {
  //           title: 'NewUserCredentialInPeople',
  //           exclude: ['id'],
  //           optional: ['peopleId']
  //         }),
  //       },
  //     },
  //   }) userCredential: Omit<UserCredential, 'id'>,
  // ): Promise<UserCredential> {
  //   return this.peopleRepository.userCredential(id).create(userCredential);
  // }

  // @patch('/people/{id}/user-credential', {
  //   responses: {
  //     '200': {
  //       description: 'People.UserCredential PATCH success count',
  //       content: {'application/json': {schema: CountSchema}},
  //     },
  //   },
  // })
  // async patch(
  //   @param.path.string('id') id: string,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(UserCredential, {partial: true}),
  //       },
  //     },
  //   })
  //   userCredential: Partial<UserCredential>,
  //   @param.query.object('where', getWhereSchemaFor(UserCredential)) where?: Where<UserCredential>,
  // ): Promise<Count> {
  //   return this.peopleRepository.userCredential(id).patch(userCredential, where);
  // }

  // @del('/people/{id}/user-credential', {
  //   responses: {
  //     '200': {
  //       description: 'People.UserCredential DELETE success count',
  //       content: {'application/json': {schema: CountSchema}},
  //     },
  //   },
  // })
  // async delete(
  //   @param.path.string('id') id: string,
  //   @param.query.object('where', getWhereSchemaFor(UserCredential)) where?: Where<UserCredential>,
  // ): Promise<Count> {
  //   return this.peopleRepository.userCredential(id).delete(where);
  // }
}

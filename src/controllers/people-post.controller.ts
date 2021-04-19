import {
  Filter,
  repository
} from '@loopback/repository';
import {
  get,
  getModelSchemaRef,
  param
} from '@loopback/rest';
import {
  Post
} from '../models';
import {PeopleRepository} from '../repositories';

export class PeoplePostController {
  constructor(
    @repository(PeopleRepository) protected peopleRepository: PeopleRepository,
  ) { }

  @get('/people/{id}/posts', {
    responses: {
      '200': {
        description: 'Array of People has many Post',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Post)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Post>,
  ): Promise<Post[]> {
    return this.peopleRepository.posts(id).find(filter);
  }

  // @post('/people/{id}/posts', {
  //   responses: {
  //     '200': {
  //       description: 'People model instance',
  //       content: {'application/json': {schema: getModelSchemaRef(Post)}},
  //     },
  //   },
  // })
  // async create(
  //   @param.path.string('id') id: typeof People.prototype.id,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(Post, {
  //           title: 'NewPostInPeople',
  //           exclude: ['id'],
  //           optional: ['peopleId']
  //         }),
  //       },
  //     },
  //   }) post: Omit<Post, 'id'>,
  // ): Promise<Post> {
  //   return this.peopleRepository.posts(id).create(post);
  // }

  // @patch('/people/{id}/posts', {
  //   responses: {
  //     '200': {
  //       description: 'People.Post PATCH success count',
  //       content: {'application/json': {schema: CountSchema}},
  //     },
  //   },
  // })
  // async patch(
  //   @param.path.string('id') id: string,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(Post, {partial: true}),
  //       },
  //     },
  //   })
  //   post: Partial<Post>,
  //   @param.query.object('where', getWhereSchemaFor(Post)) where?: Where<Post>,
  // ): Promise<Count> {
  //   return this.peopleRepository.posts(id).patch(post, where);
  // }

  // @del('/people/{id}/posts', {
  //   responses: {
  //     '200': {
  //       description: 'People.Post DELETE success count',
  //       content: {'application/json': {schema: CountSchema}},
  //     },
  //   },
  // })
  // async delete(
  //   @param.path.string('id') id: string,
  //   @param.query.object('where', getWhereSchemaFor(Post)) where?: Where<Post>,
  // ): Promise<Count> {
  //   return this.peopleRepository.posts(id).delete(where);
  // }
}

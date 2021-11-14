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
import {Post, User} from '../models';
import {PostRepository} from '../repositories';

export class PostImporterController {
  constructor(
    @repository(PostRepository) protected postRepository: PostRepository,
  ) {}

  @get('/posts/{id}/importers', {
    responses: {
      '200': {
        description: 'Array of Post has many User through PostImporter',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(User)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<User>,
  ): Promise<User[]> {
    return this.postRepository.importers(id).find(filter);
  }
}

import {
  repository
} from '@loopback/repository';
import {
  get,
  getModelSchemaRef,
  param
} from '@loopback/rest';
import {
  People,
  Post
} from '../models';
import {PostRepository} from '../repositories';

export class PostPeopleController {
  constructor(
    @repository(PostRepository)
    public postRepository: PostRepository,
  ) { }

  @get('/posts/{id}/people', {
    responses: {
      '200': {
        description: 'People belonging to Post',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(People)},
          },
        },
      },
    },
  })
  async getPeople(
    @param.path.string('id') id: typeof Post.prototype.id,
  ): Promise<People> {
    return this.postRepository.people(id);
  }
}

import {Count, CountSchema, repository} from '@loopback/repository';
import {del, get, getModelSchemaRef, param, response} from '@loopback/rest';
import {DraftPost} from '../models';
import {DraftPostRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
export class UserDraftPostController {
  constructor(
    @repository(DraftPostRepository)
    protected draftPostRepository: DraftPostRepository,
  ) {}

  @authenticate.skip()
  @get('/users/{userId}/draft')
  @response(200, {
    description: 'Draft Post model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(DraftPost, {includeRelations: true}),
      },
    },
  })
  async getDraftPost(
    @param.path.string('userId') userId: string,
  ): Promise<DraftPost | null> {
    return this.draftPostRepository.findOne({
      where: {
        createdBy: userId,
      },
    });
  }

  @del('/users/{userId}/draft')
  @response(200, {
    description: 'Delete Draft Post model instance',
    content: {'application/json': {schema: CountSchema}},
  })
  async deleteDraftPost(
    @param.path.string('userId') userId: string,
  ): Promise<Count> {
    return this.draftPostRepository.deleteAll({
      createdBy: userId,
    });
  }
}

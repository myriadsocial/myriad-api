import {Filter, repository} from '@loopback/repository';
import {get, getModelSchemaRef, param} from '@loopback/rest';
import {User} from '../models';
import {ReportRepository} from '../repositories';

export class ReportUserController {
  constructor(
    @repository(ReportRepository)
    protected reportRepository: ReportRepository,
  ) {}

  @get('/reports/{id}/users', {
    responses: {
      '200': {
        description: 'Array of Report has many User through ReportUser',
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
    return this.reportRepository.reporters(id).find(filter);
  }
}

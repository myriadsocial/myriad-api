import {authenticate} from '@loopback/authentication';
import {intercept, service} from '@loopback/core';
import {getModelSchemaRef, post, requestBody, response} from '@loopback/rest';
import {CreateInterceptor} from '../../interceptors';
import {CreateReportDto, Report} from '../../models';
import {UserService} from '../../services';

@authenticate('jwt')
export class UserReportController {
  constructor(
    @service(UserService)
    protected userService: UserService,
  ) {}

  @intercept(CreateInterceptor.BINDING_KEY)
  @post('/reports')
  @response(200, {
    description: 'CREATE report',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Report),
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(CreateReportDto, {
            title: 'NewReport',
            optional: ['type'],
          }),
        },
      },
    })
    data: CreateReportDto,
  ): Promise<Report> {
    return this.userService.createReport(data);
  }
}

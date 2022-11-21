import {authenticate} from '@loopback/authentication';
import {service} from '@loopback/core';
import {get, getModelSchemaRef, param, response} from '@loopback/rest';
import {PermissionKeys} from '../enums';
import {People} from '../models';
import {PeopleService} from '../services';

@authenticate({strategy: 'jwt', options: {required: [PermissionKeys.ADMIN]}})
export class PeopleController {
  constructor(
    @service(PeopleService)
    private peopleService: PeopleService,
  ) {}

  @get('/people/search')
  @response(200, {
    description: 'Array of People model instance',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(People),
        },
      },
    },
  })
  async searchPeople(@param.query.string('q') q?: string): Promise<People[]> {
    return this.peopleService.search(q);
  }
}

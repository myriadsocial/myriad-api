import {authenticate} from '@loopback/authentication';
import {intercept} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  requestBody,
} from '@loopback/rest';
import {AuthorizeInterceptor} from '../interceptors';
import {LanguageSetting} from '../models';
import {UserRepository} from '../repositories';

@authenticate('jwt')
@intercept(AuthorizeInterceptor.BINDING_KEY)
export class UserLanguageSettingController {
  constructor(
    @repository(UserRepository) protected userRepository: UserRepository,
  ) {}

  @get('/users/{id}/language-setting', {
    responses: {
      '200': {
        description: 'User has one LanguageSetting',
        content: {
          'application/json': {
            schema: getModelSchemaRef(LanguageSetting),
          },
        },
      },
    },
  })
  async get(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<LanguageSetting>,
  ): Promise<LanguageSetting> {
    return this.userRepository.languageSetting(id).get(filter);
  }

  @patch('/users/{id}/language-setting', {
    responses: {
      '200': {
        description: 'User.LanguageSetting PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(LanguageSetting, {partial: true}),
        },
      },
    })
    languageSetting: Partial<LanguageSetting>,
    @param.query.object('where', getWhereSchemaFor(LanguageSetting))
    where?: Where<LanguageSetting>,
  ): Promise<Count> {
    return this.userRepository
      .languageSetting(id)
      .patch(languageSetting, where);
  }
}

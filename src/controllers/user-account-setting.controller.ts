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
import {AccountSetting} from '../models';
import {UserRepository} from '../repositories';
import {authenticate} from '@loopback/authentication';

@authenticate('jwt')
export class UserAccountSettingController {
  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
  ) {}

  @authenticate.skip()
  @get('/users/{id}/account-setting', {
    responses: {
      '200': {
        description: 'User has one AccountSetting',
        content: {
          'application/json': {
            schema: getModelSchemaRef(AccountSetting),
          },
        },
      },
    },
  })
  async get(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<AccountSetting>,
  ): Promise<AccountSetting> {
    return this.userRepository.accountSetting(id).get(filter);
  }

  @patch('/users/{id}/account-setting', {
    responses: {
      '200': {
        description: 'User.AccountSetting PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(AccountSetting, {
            partial: true,
            exclude: ['id', 'userId'],
          }),
        },
      },
    })
    accountSetting: Partial<AccountSetting>,
    @param.query.object('where', getWhereSchemaFor(AccountSetting))
    where?: Where<AccountSetting>,
  ): Promise<Count> {
    return this.userRepository.accountSetting(id).patch(accountSetting, where);
  }
}

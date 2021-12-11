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
import {AccountSettingType, VisibilityType} from '../enums';
import {AccountSetting} from '../models';
import {
  PeopleRepository,
  PostRepository,
  UserRepository,
  UserSocialMediaRepository,
} from '../repositories';
import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {LoggingBindings, logInvocation, WinstonLogger} from '@loopback/logging';

@authenticate('jwt')
export class UserAccountSettingController {
  // Inject a winston logger
  @inject(LoggingBindings.WINSTON_LOGGER)
  private logger: WinstonLogger;

  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @repository(PostRepository)
    protected postRepository: PostRepository,
    @repository(UserSocialMediaRepository)
    protected userSocialMediaRepository: UserSocialMediaRepository,
    @repository(PeopleRepository)
    protected peopleRepository: PeopleRepository,
  ) {}

  @logInvocation()
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

  @logInvocation()
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
          schema: getModelSchemaRef(AccountSetting, {partial: true}),
        },
      },
    })
    accountSetting: Partial<AccountSetting>,
    @param.query.object('where', getWhereSchemaFor(AccountSetting))
    where?: Where<AccountSetting>,
  ): Promise<Count> {
    const {accountPrivacy, socialMediaPrivacy} = accountSetting;

    if (accountPrivacy) {
      await this.postRepository.updateAll(
        {visibility: accountPrivacy as unknown as VisibilityType},
        {createdBy: id, privacyDefault: VisibilityType.PUBLIC},
      );
    }

    if (socialMediaPrivacy) {
      const peopleIds = (
        await this.userSocialMediaRepository.find({
          where: {
            userId: id,
          },
        })
      ).map(e => {
        return {
          id: e.id,
        };
      });

      if (peopleIds.length > 0) {
        await this.peopleRepository.updateAll(
          {
            isPrivate:
              socialMediaPrivacy === AccountSettingType.PRIVATE ? true : false,
          },
          {or: peopleIds},
        );

        await this.postRepository.updateAll(
          {
            ownerPrivacy:
              socialMediaPrivacy === AccountSettingType.PRIVATE ? true : false,
          },
          {or: peopleIds},
        );
      }
    }

    return this.userRepository.accountSetting(id).patch(accountSetting, where);
  }
}

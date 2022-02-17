import {AuthenticationStrategy, TokenService} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors, Request} from '@loopback/rest';
import {UserProfile, securityId} from '@loopback/security';
import {config} from '../../config';
import {TokenServiceBindings} from '../../keys';
import {UserRepository} from '../../repositories';

export class JWTAuthenticationStrategy implements AuthenticationStrategy {
  name = 'jwt';

  constructor(
    @repository(UserRepository)
    protected userRepository: UserRepository,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    public tokenService: TokenService,
  ) {}

  async authenticate(request: Request): Promise<UserProfile | undefined> {
    let userProfile: UserProfile = {
      [securityId]: config.MYRIAD_OFFICIAL_ACCOUNT_PUBLIC_KEY,
    };

    try {
      const token: string = this.extractCredentials(request);
      userProfile = await this.tokenService.verifyToken(token);
    } catch (err) {
      // Handle posts and users
      if (request.method === 'GET') return userProfile;
      throw err;
    }

    const user = await this.userRepository.findOne({
      where: {
        id: userProfile[securityId],
        username: userProfile.username,
      },
    });

    if (!user) throw new HttpErrors.Unauthorized('Forbidden user!');

    userProfile.defaultCurrency = user.defaultCurrency;
    userProfile.permissions = user.permissions;

    if (request.method === 'GET') return userProfile;
    if (user.deletedAt)
      throw new HttpErrors.UnprocessableEntity(
        'You cannot create, update, or delete',
      );
    return userProfile;
  }

  extractCredentials(request: Request): string {
    if (!request.headers.authorization) {
      throw new HttpErrors.Unauthorized(`Authorization header not found.`);
    }

    // for example : Bearer xxx.yyy.zzz
    const authHeaderValue = request.headers.authorization;

    if (!authHeaderValue.startsWith('Bearer')) {
      throw new HttpErrors.Unauthorized(
        `Authorization header is not of type 'Bearer'.`,
      );
    }

    //split the string into 2 parts : 'Bearer ' and the `xxx.yyy.zzz`
    const parts = authHeaderValue.split(' ');
    if (parts.length !== 2)
      throw new HttpErrors.Unauthorized(
        `Authorization header value has too many parts. It must follow the pattern: 'Bearer xx.yy.zz' where xx.yy.zz is a valid JWT token.`,
      );
    const token = parts[1];

    return token;
  }
}

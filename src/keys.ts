import {TokenService, UserService} from '@loopback/authentication';
import {BindingKey} from '@loopback/core';
import {config} from './config';
import {RefreshTokenService} from './interfaces';
import {Authentication} from './models';
import {Credentials} from './repositories/authentication.repository';
import {PasswordHasher} from './services/authentication/hash.password.service';

export namespace TokenServiceConstants {
  export const TOKEN_SECRET_VALUE = config.TOKEN_SECRET_KEY;
  export const TOKEN_EXPIRES_IN_VALUE = config.TOKEN_EXPIRES_IN;
}

export namespace TokenServiceBindings {
  export const TOKEN_SECRET = BindingKey.create<string>('authentication.jwt.secret');
  export const TOKEN_EXPIRES_IN = BindingKey.create<string>(
    'authentication.jwt.expires.in.seconds',
  );
  export const TOKEN_SERVICE = BindingKey.create<TokenService>(
    'services.authentication.jwt.tokenservice',
  );
}

/**
 * Constant values used when generating refresh token.
 */
export namespace RefreshTokenConstants {
  /**
   * The default secret used when generating refresh token.
   */
  export const REFRESH_SECRET_VALUE = config.REFRESH_SECRET_KEY;
  /**
   * The default expiration time for refresh token.
   */
  export const REFRESH_EXPIRES_IN_VALUE = config.REFRESH_EXPIRES_IN;
  /**
   * The default issuer used when generating refresh token.
   */
  export const REFRESH_ISSUER_VALUE = 'myriad';
}

export namespace RefreshTokenServiceBindings {
  export const REFRESH_TOKEN_SERVICE = BindingKey.create<RefreshTokenService>(
    'services.authentication.jwt.refresh.tokenservice',
  );
  export const REFRESH_SECRET = BindingKey.create<string>('authentication.jwt.refresh.secret');
  export const REFRESH_EXPIRES_IN = BindingKey.create<string>(
    'authentication.jwt.refresh.expires.in.seconds',
  );
  export const REFRESH_ISSUER = BindingKey.create<string>('authentication.jwt.refresh.issuer');

  export const REFRESH_REPOSITORY = 'repositories.RefreshTokenRepository';
}

export namespace PasswordHasherBindings {
  export const PASSWORD_HASHER = BindingKey.create<PasswordHasher>('services.hasher');
  export const ROUNDS = BindingKey.create<number>('services.hasher.rounds');
}

export namespace AuthServiceBindings {
  export const AUTH_SERVICE =
    BindingKey.create<UserService<Authentication, Credentials>>('services.user.service');
  export const AUTH_REPOSITORY = 'repositories.AuthenticationRepository';
  export const AUTH_CREDENTIAL_REPOSITORY = 'repositories.AuthCredentialRepository';
}

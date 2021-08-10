import {registerAuthenticationStrategy} from '@loopback/authentication';
import {
  Application,
  Binding,
  Component,
  CoreBindings,
  createBindingFromClass,
  inject
} from '@loopback/core';
import {
  AuthServiceBindings,
  PasswordHasherBindings,
  RefreshTokenConstants,
  RefreshTokenServiceBindings,
  TokenServiceBindings,
  TokenServiceConstants
} from '../keys';
import {
  AuthCredentialRepository,
  AuthenticationRepository,
  AuthRefreshTokenRepository
} from '../repositories';
import {MyAuthService, RefreshtokenService} from '../services';
import {BcryptHasher} from '../services/authentication/hash.password.service';
import {JWTAuthenticationStrategy} from '../services/authentication/jwt.auth.strategy';
import {JWTService} from '../services/authentication/jwt.service';
import {SecuritySpecEnhancer} from '../services/authentication/security.spec.enhancer';

export class JWTAuthenticationComponent implements Component {
  bindings: Binding[] = [
    // token bindings
    Binding.bind(TokenServiceBindings.TOKEN_SECRET).to(TokenServiceConstants.TOKEN_SECRET_VALUE),
    Binding.bind(TokenServiceBindings.TOKEN_EXPIRES_IN).to(
      TokenServiceConstants.TOKEN_EXPIRES_IN_VALUE,
    ),
    Binding.bind(TokenServiceBindings.TOKEN_SERVICE).toClass(JWTService),

    // user bindings
    Binding.bind(AuthServiceBindings.AUTH_SERVICE).toClass(MyAuthService),
    Binding.bind(AuthServiceBindings.AUTH_REPOSITORY).toClass(AuthenticationRepository),
    Binding.bind(AuthServiceBindings.AUTH_CREDENTIAL_REPOSITORY).toClass(AuthCredentialRepository),
    createBindingFromClass(SecuritySpecEnhancer),
    ///refresh bindings
    Binding.bind(RefreshTokenServiceBindings.REFRESH_TOKEN_SERVICE).toClass(RefreshtokenService),

    //  Refresh token bindings
    Binding.bind(RefreshTokenServiceBindings.REFRESH_SECRET).to(
      RefreshTokenConstants.REFRESH_SECRET_VALUE,
    ),
    Binding.bind(RefreshTokenServiceBindings.REFRESH_EXPIRES_IN).to(
      RefreshTokenConstants.REFRESH_EXPIRES_IN_VALUE,
    ),
    Binding.bind(RefreshTokenServiceBindings.REFRESH_ISSUER).to(
      RefreshTokenConstants.REFRESH_ISSUER_VALUE,
    ),
    //refresh token repository binding
    Binding.bind(RefreshTokenServiceBindings.REFRESH_REPOSITORY).toClass(
      AuthRefreshTokenRepository,
    ),
    // HasherBinding
    Binding.bind(PasswordHasherBindings.PASSWORD_HASHER).toClass(BcryptHasher),
    Binding.bind(PasswordHasherBindings.ROUNDS).to(10),
  ];
  constructor(@inject(CoreBindings.APPLICATION_INSTANCE) app: Application) {
    registerAuthenticationStrategy(app, JWTAuthenticationStrategy);
  }
}

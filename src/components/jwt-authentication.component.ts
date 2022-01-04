import {registerAuthenticationStrategy} from '@loopback/authentication';
import {
  Application,
  Binding,
  Component,
  CoreBindings,
  inject,
} from '@loopback/core';
import {
  RefreshTokenConstants,
  RefreshTokenServiceBindings,
  TokenServiceBindings,
  TokenServiceConstants,
} from '../keys';
import {UserRefreshTokenRepository} from '../repositories';
import {RefreshtokenService} from '../services';
import {JWTAuthenticationStrategy} from '../services/authentication/jwt.auth.strategy';
import {JWTService} from '../services/authentication/jwt.service';

export class JWTAuthenticationComponent implements Component {
  bindings: Binding[] = [
    // token bindings
    Binding.bind(TokenServiceBindings.TOKEN_SECRET).to(
      TokenServiceConstants.TOKEN_SECRET_VALUE,
    ),
    Binding.bind(TokenServiceBindings.TOKEN_EXPIRES_IN).to(
      TokenServiceConstants.TOKEN_EXPIRES_IN_VALUE,
    ),
    Binding.bind(TokenServiceBindings.TOKEN_SERVICE).toClass(JWTService),

    ///refresh bindings
    Binding.bind(RefreshTokenServiceBindings.REFRESH_TOKEN_SERVICE).toClass(
      RefreshtokenService,
    ),

    //  Refresh token bindings
    Binding.bind(RefreshTokenServiceBindings.REFRESH_SECRET).to(
      RefreshTokenConstants.REFRESH_SECRET_VALUE,
    ),
    Binding.bind(RefreshTokenServiceBindings.JWT_REFRESH_TOKEN_EXPIRES_IN).to(
      RefreshTokenConstants.REFRESH_EXPIRES_IN_VALUE,
    ),
    Binding.bind(RefreshTokenServiceBindings.REFRESH_ISSUER).to(
      RefreshTokenConstants.REFRESH_ISSUER_VALUE,
    ),
    //refresh token repository binding
    Binding.bind(RefreshTokenServiceBindings.REFRESH_REPOSITORY).toClass(
      UserRefreshTokenRepository,
    ),
  ];
  constructor(@inject(CoreBindings.APPLICATION_INSTANCE) app: Application) {
    registerAuthenticationStrategy(app, JWTAuthenticationStrategy);
  }
}

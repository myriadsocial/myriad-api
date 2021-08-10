import {TokenService} from '@loopback/authentication';
import {BindingScope, generateUniqueId, inject, injectable} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import dotenv from 'dotenv';
import {promisify} from 'util';
import {TokenObject} from '../../interfaces';
import {AuthServiceBindings, RefreshTokenServiceBindings, TokenServiceBindings} from '../../keys';
import {AuthRefreshToken, AuthRefreshTokenRelations} from '../../models';
import {AuthRefreshTokenRepository} from '../../repositories';
import {MyAuthService} from './authentication.service';

dotenv.config();

const jwt = require('jsonwebtoken');
const signAsync = promisify(jwt.sign);
const verifyAsync = promisify(jwt.verify);

@injectable({scope: BindingScope.TRANSIENT})
export class RefreshtokenService {
  constructor(
    @inject(RefreshTokenServiceBindings.REFRESH_SECRET)
    private refreshSecret: string,
    @inject(RefreshTokenServiceBindings.REFRESH_EXPIRES_IN)
    private refreshExpiresIn: string,
    @inject(RefreshTokenServiceBindings.REFRESH_ISSUER)
    private refreshIssure: string,
    @repository(AuthRefreshTokenRepository)
    public authRefreshTokenRepository: AuthRefreshTokenRepository,
    @inject(AuthServiceBindings.AUTH_SERVICE) public authService: MyAuthService,
    @inject(TokenServiceBindings.TOKEN_SERVICE) public jwtService: TokenService,
  ) {}
  /**
   * Generate a refresh token, bind it with the given user profile + access
   * token, then store them in backend.
   */
  async generateToken(authProfile: UserProfile, token: string): Promise<TokenObject> {
    const data = {
      token: generateUniqueId(),
    };
    const refreshToken = await signAsync(data, this.refreshSecret, {
      expiresIn: Number(this.refreshExpiresIn),
      issuer: this.refreshIssure,
    });
    const result = {
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn: `${this.refreshExpiresIn} seconds`,
      refreshToken: refreshToken,
    };
    await this.authRefreshTokenRepository.create({
      authenticationId: authProfile[securityId],
      refreshToken: result.refreshToken,
    });
    return result;
  }

  /*
   * Refresh the access token bound with the given refresh token.
   */
  async refreshToken(refreshToken: string): Promise<TokenObject> {
    try {
      if (!refreshToken) {
        throw new HttpErrors.Unauthorized(`Error verifying token : 'refresh token' is null`);
      }

      const authRefreshData = await this.verifyToken(refreshToken);
      const authentication = await this.authService.findAuthById(
        authRefreshData.authenticationId.toString(),
      );
      const authProfile: UserProfile = this.authService.convertToUserProfile(authentication);
      // create a JSON Web Token based on the user profile
      const token = await this.jwtService.generateToken(authProfile);

      return {
        accessToken: token,
      };
    } catch (error) {
      throw new HttpErrors.Unauthorized(`Error verifying token : ${error.message}`);
    }
  }

  /*
   * [TODO] test and endpoint
   */
  async revokeToken(refreshToken: string) {
    try {
      await this.authRefreshTokenRepository.delete(
        new AuthRefreshToken({refreshToken: refreshToken}),
      );
    } catch (e) {
      // ignore
    }
  }

  /**
   * Verify the validity of a refresh token, and make sure it exists in backend.
   * @param refreshToken
   */
  async verifyToken(refreshToken: string): Promise<AuthRefreshToken & AuthRefreshTokenRelations> {
    try {
      await verifyAsync(refreshToken, this.refreshSecret);
      const authRefreshData = await this.authRefreshTokenRepository.findOne({
        where: {refreshToken: refreshToken},
      });

      if (!authRefreshData) {
        throw new HttpErrors.Unauthorized(`Error verifying token : Invalid Token`);
      }
      return authRefreshData;
    } catch (error) {
      throw new HttpErrors.Unauthorized(`Error verifying token : ${error.message}`);
    }
  }
}

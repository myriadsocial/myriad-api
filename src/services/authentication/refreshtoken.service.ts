import {TokenService} from '@loopback/authentication';
import {
  BindingScope,
  generateUniqueId,
  inject,
  injectable,
} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {promisify} from 'util';
import {TokenObject} from '../../interfaces';
import {RefreshTokenServiceBindings, TokenServiceBindings} from '../../keys';
import {UserRefreshToken, UserRefreshTokenRelations} from '../../models';
import {UserRefreshTokenRepository, UserRepository} from '../../repositories';

const jwt = require('jsonwebtoken');
const signAsync = promisify(jwt.sign);
const verifyAsync = promisify(jwt.verify);

@injectable({scope: BindingScope.TRANSIENT})
export class RefreshtokenService {
  constructor(
    @repository(UserRepository)
    public userRepository: UserRepository,
    @repository(UserRefreshTokenRepository)
    public userRefreshTokenRepository: UserRefreshTokenRepository,
    @inject(RefreshTokenServiceBindings.REFRESH_SECRET)
    private refreshSecret: string,
    @inject(RefreshTokenServiceBindings.JWT_REFRESH_TOKEN_EXPIRES_IN)
    private refreshExpiresIn: string,
    @inject(RefreshTokenServiceBindings.REFRESH_ISSUER)
    private refreshIssure: string,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    public jwtService: TokenService,
  ) {}
  /**
   * Generate a refresh token, bind it with the given user profile + access
   * token, then store them in backend.
   */
  async generateToken(
    userProfile: UserProfile,
    token: string,
  ): Promise<TokenObject> {
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

    return result;
  }

  /*
   * Refresh the access token bound with the given refresh token.
   */
  async refreshToken(refreshToken: string): Promise<TokenObject> {
    try {
      if (!refreshToken) {
        throw new HttpErrors.Unauthorized(
          `Error verifying token : 'refresh token' is null`,
        );
      }

      const userRefreshData = await this.verifyToken(refreshToken);
      const user = await this.userRepository.findById(userRefreshData.userId);
      const userProfile: UserProfile = {
        [securityId]: user.id!.toString(),
        id: user.id,
        name: user.name,
        username: user.username,
      };
      const token = await this.jwtService.generateToken(userProfile);

      return {accessToken: token, refreshToken: refreshToken};
    } catch (error) {
      throw new HttpErrors.Unauthorized(
        `Error verifying token : ${error.message}`,
      );
    }
  }

  /*
   * [TODO] test and endpoint
   */
  async revokeToken(refreshToken: string) {
    try {
      await this.userRefreshTokenRepository.delete(
        new UserRefreshToken({refreshToken: refreshToken}),
      );
    } catch (e) {
      // ignore
    }
  }

  /**
   * Verify the validity of a refresh token, and make sure it exists in backend.
   * @param refreshToken
   */
  async verifyToken(
    refreshToken: string,
  ): Promise<UserRefreshToken & UserRefreshTokenRelations> {
    try {
      await verifyAsync(refreshToken, this.refreshSecret);
      const authRefreshData = await this.userRefreshTokenRepository.findOne({
        where: {refreshToken: refreshToken},
      });

      if (!authRefreshData) {
        throw new HttpErrors.Unauthorized(
          `Error verifying token : Invalid Token`,
        );
      }
      return authRefreshData;
    } catch (error) {
      throw new HttpErrors.Unauthorized(
        `Error verifying token : ${error.message}`,
      );
    }
  }
}

import {TokenService} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {promisify} from 'util';
import {TokenServiceBindings} from '../../keys';

const jwt = require('jsonwebtoken');
const signAsync = promisify(jwt.sign);
const verifyAsync = promisify(jwt.verify);

export class JWTService implements TokenService {
  constructor(
    @inject(TokenServiceBindings.TOKEN_SECRET)
    private jwtSecret: string,
    @inject(TokenServiceBindings.TOKEN_EXPIRES_IN)
    private readonly expiresSecret: string,
  ) {}

  async generateToken(userProfile: UserProfile): Promise<string> {
    if (!userProfile) {
      throw new HttpErrors.Unauthorized(
        'Error while generating token :userProfile is null',
      );
    }
    const userInfoForToken = {
      id: userProfile[securityId],
      username: userProfile.username,
      createdAt: userProfile.createdAt,
      permissions: userProfile.permissions,
      networkId: userProfile.networkId,
      walletId: userProfile.walletId,
      walletType: userProfile.walletType,
      blockchainPlatform: userProfile.blockchainPlatform,
      email: userProfile.email,
      fullAccess: Boolean(userProfile.fullAccess),
    };

    try {
      return signAsync(userInfoForToken, this.jwtSecret);
    } catch (err) {
      throw new HttpErrors.Unauthorized(`error generating token ${err}`);
    }
  }

  async verifyToken(token: string): Promise<UserProfile> {
    if (!token) {
      throw new HttpErrors.Unauthorized(
        `Error verifying token:'token' is null`,
      );
    }

    try {
      const decryptedToken = await verifyAsync(token, this.jwtSecret);

      return {
        [securityId]: decryptedToken.id,
        id: decryptedToken.id,
        username: decryptedToken.username,
        createdAt: decryptedToken.createdAt,
        permissions: decryptedToken.permissions,
        networkId: decryptedToken.networkId,
        walletId: decryptedToken.walletId,
        walletType: decryptedToken.walletType,
        blockchainPlatform: decryptedToken.blockchainPlatform,
        email: decryptedToken.email,
        fullAccess: decryptedToken.fullAccess,
      };
    } catch (err) {
      throw new HttpErrors.Unauthorized(`Error verifying token:${err.message}`);
    }
  }
}

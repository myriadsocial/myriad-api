import {inject} from '@loopback/core';
import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import {promisify} from 'util';
import {TokenServiceBindings} from '../../keys';
import {TokenService} from '@loopback/authentication';
import {AnyObject} from '@loopback/repository';
import {config} from '../../config';

const jwt = require('jsonwebtoken');
const signAsync = promisify(jwt.sign);
const verifyAsync = promisify(jwt.verify);

export class JWTService implements TokenService {
  constructor(
    @inject(TokenServiceBindings.TOKEN_SECRET)
    private jwtSecret: string,
    @inject(TokenServiceBindings.TOKEN_EXPIRES_IN)
    public readonly expiresSecret: string,
  ) {}

  async generateToken(userProfile: UserProfile): Promise<string> {
    if (!userProfile) {
      throw new HttpErrors.Unauthorized(
        'Error while generating token :userProfile is null',
      );
    }
    const userInfoForToken = {
      id: userProfile[securityId],
      name: userProfile.name,
      username: userProfile.username,
      createdAt: userProfile.createdAt,
      permissions: userProfile.permissions,
      publicAddress: userProfile.publicAddress,
      network: userProfile.network,
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

    let userProfile: UserProfile;
    try {
      const decryptedToken = await verifyAsync(token, this.jwtSecret);
      userProfile = Object.assign(
        {
          [securityId]: '',
          id: '',
          name: '',
          username: '',
          createdAt: '',
          permissions: [],
          publicAddress: '',
          network: '',
        },
        {
          [securityId]: decryptedToken.id,
          id: decryptedToken.id,
          name: decryptedToken.name,
          username: decryptedToken.username,
          createdAt: decryptedToken.createdAt,
          permissions: decryptedToken.permissions,
          publicAddres: decryptedToken.publicAddres,
          network: decryptedToken.network,
        },
      );
    } catch (err) {
      throw new HttpErrors.Unauthorized(`Error verifying token:${err.message}`);
    }
    return userProfile;
  }

  async generateAnyToken(payload: AnyObject): Promise<string> {
    if (!payload) {
      throw new HttpErrors.Unauthorized(
        'Error while generating token :payload is null',
      );
    }
    let token: string;
    try {
      token = await signAsync(payload, config.MYRIAD_ESCROW_SECRET_KEY);
    } catch (err) {
      throw new HttpErrors.Unauthorized(`error generating token ${err}`);
    }

    return token;
  }
}

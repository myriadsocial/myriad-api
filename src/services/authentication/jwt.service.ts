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
    private jwtExpiresIn: string,
  ) {}

  async generateToken(authProfile: UserProfile): Promise<string> {
    if (!authProfile) {
      throw new HttpErrors.Unauthorized(
        'Error while generating token :userProfile is null',
      );
    }
    const authInfoForToken = {
      id: authProfile[securityId],
      name: authProfile.name,
      email: authProfile.email,
    };
    let token: string;
    try {
      token = await signAsync(authInfoForToken, this.jwtSecret, {
        expiresIn: Number(this.jwtExpiresIn),
      });
    } catch (err) {
      throw new HttpErrors.Unauthorized(`error generating token ${err}`);
    }

    return token;
  }

  async verifyToken(token: string): Promise<UserProfile> {
    if (!token) {
      throw new HttpErrors.Unauthorized(
        `Error verifying token:'token' is null`,
      );
    }

    let authProfile: UserProfile;
    try {
      const decryptedToken = await verifyAsync(token, this.jwtSecret);
      authProfile = Object.assign(
        {[securityId]: '', id: '', name: ''},
        {
          [securityId]: decryptedToken.id,
          id: decryptedToken.id,
          name: decryptedToken.name,
        },
      );
    } catch (err) {
      throw new HttpErrors.Unauthorized(`Error verifying token:${err.message}`);
    }
    return authProfile;
  }

  async generateAnyToken(payload: AnyObject): Promise<string> {
    if (!payload) {
      throw new HttpErrors.Unauthorized(
        'Error while generating token :payload is null',
      );
    }
    let token: string;
    try {
      token = await signAsync(payload, config.ESCROW_SECRET_KEY);
    } catch (err) {
      throw new HttpErrors.Unauthorized(`error generating token ${err}`);
    }

    return token;
  }
}

import {inject} from '@loopback/core';
import {compare, genSalt, hash} from 'bcryptjs';
import {PasswordHasherBindings} from '../../keys';

export interface PasswordHasher<T = string> {
  hashPassword(password: T): Promise<T>;
  comparePassword(provdedPass: T, storedPass: T): Promise<boolean>;
}

export class BcryptHasher implements PasswordHasher<string> {
  async comparePassword(
    provdedPass: string,
    storedPass: string,
  ): Promise<boolean> {
    const passwordMatches = await compare(provdedPass, storedPass);
    return passwordMatches;
  }

  @inject(PasswordHasherBindings.ROUNDS)
  public readonly rounds: number;

  async hashPassword(password: string): Promise<string> {
    const salt = await genSalt(this.rounds);
    return hash(password, salt);
  }
}

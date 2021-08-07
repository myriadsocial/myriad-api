import {People} from '../models';

export interface ExtendedPeople extends People {
  publicKey: string;
}

import {StatusType} from '../enums';
import {People} from '../models';

export interface ExtendedPeople extends People {
  status?: StatusType;
}

export interface Tag {
  id: string;
  status?: StatusType;
}

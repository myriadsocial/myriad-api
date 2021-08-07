import {StatusType} from '../enums';
import {People} from '../models';

export interface Person extends People {
  status: StatusType;
}

export interface Tag {
  id: string;
  status: StatusType;
}

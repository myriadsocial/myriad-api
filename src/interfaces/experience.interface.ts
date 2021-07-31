import {UpdatedStatusType} from '../enums';
import {People} from '../models';

export interface Person extends People {
  updatedStatus: UpdatedStatusType;
}

export interface Tag {
  id: string;
  updatedStatus: UpdatedStatusType;
}

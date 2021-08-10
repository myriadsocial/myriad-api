import {StatusType} from '../enums';
import {People} from '../models';

export interface ExperiencePeople extends People {
  status?: StatusType;
}

export interface ExperienceTag {
  id: string;
  status?: StatusType;
}

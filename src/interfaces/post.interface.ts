import {Post, People} from '../models';

export interface ExtendedPost extends Post {
  platformUser?: Omit<People, 'id'>;
}

import {Filter} from '@loopback/repository';
import {UpdatedStatusType} from '../enums';
import {Person, Tag} from '../interfaces';

export function noneStatusFiltering(data: Tag[] | Person[]): string[] {
  return data
    .filter(e => {
      if (e.updatedStatus === UpdatedStatusType.NONE || !e.updatedStatus) return true;
      return false;
    })
    .map(e => e.id);
}

export function defaultFilterQuery(page?: number, filter?: Filter<any>): Filter<any> {
  if (!page) page = 1;

  let pageNumber = Number(page) - 1;
  let itemsPerPage = filter ? (filter.limit ? filter.limit : 5) : 5;

  if (!filter) {
    return {
      limit: itemsPerPage,
      skip: pageNumber * itemsPerPage,
    };
  }

  filter.limit = itemsPerPage;
  filter.skip = itemsPerPage * pageNumber;

  return filter;
}

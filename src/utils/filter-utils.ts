import {Filter, Where} from '@loopback/repository';
import {StatusType} from '../enums';
import {ExperiencePeople, ExperienceTag} from '../interfaces';

/* eslint-disable  @typescript-eslint/no-explicit-any */

export function noneStatusFiltering(data: ExperienceTag[] | ExperiencePeople[]): string[] {
  return data
    .filter(e => {
      if (e.status === StatusType.NONE || !e.status) return true;
      return false;
    })
    .map(e => e.id);
}

export function defaultFilterQuery(pageNumber = 1, filter?: Filter, where?: Where): Filter {
  let itemsPerPage = 5;

  if (!filter) {
    return {
      limit: itemsPerPage,
      skip: (pageNumber - 1) * itemsPerPage,
    };
  }

  if (filter.limit) itemsPerPage = filter.limit;
  if (where) filter.where = where;

  filter.skip = itemsPerPage * (pageNumber - 1);
  filter.limit = itemsPerPage;

  return filter;
}

export function updatedFiltering(data1: any[], data2: any[]) {
  return data1.filter(item1 => {
    const found = data2.find(item2 => item1.id === item2.id);

    if (!found) return true;
    return false;
  });
}

export function setStatus(data: any[], status: StatusType) {
  return data.map(item => {
    item.status = status;
    return item;
  });
}

export function approvedUpdate(data: any[], isApproved: boolean) {
  return data
    .filter(item => {
      if (isApproved) {
        if (item.status === StatusType.NEW) return true;
        if (item.status === StatusType.DELETED) return false;
      } else {
        if (item.status === StatusType.NEW) return false;
        if (item.status === StatusType.DELETED) return true;
      }

      return true;
    })
    .map(item => {
      item.status = StatusType.NONE;
      return item;
    });
}

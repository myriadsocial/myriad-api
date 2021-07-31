import {UpdatedStatusType} from "../enums";
import {Person, Tag} from "../interfaces";

export function noneStatusFiltering(data: Tag[] | Person[]): string[] {
  return data.filter(e => {
    if (e.updatedStatus === UpdatedStatusType.NONE || !e.updatedStatus) return true;
    return false;
  })
  .map(e => e.id);
}


import {MetaPagination} from '../interfaces';

/* eslint-disable  @typescript-eslint/no-explicit-any */
export function pageMetadata(args: any[], total: number): MetaPagination {
  let currentPage = +args[0];
  let currentLimit = args[1] ? +args[1].limit : null;

  if (!currentPage) currentPage = 1;
  if (!currentLimit) currentLimit = 5;

  const itemsPerPage = currentLimit > total ? total : currentLimit;
  const totalItemCount = total;
  const totalPageCount = Math.ceil(totalItemCount / itemsPerPage);

  const meta: MetaPagination = {
    totalItemCount,
    totalPageCount,
    itemsPerPage,
  };

  if (currentPage <= meta.totalPageCount) {
    meta.currentPage = currentPage;

    if (currentPage !== 1) {
      meta.previousPage = currentPage - 1;
    }

    if (currentPage !== meta.totalPageCount) {
      meta.nextPage = meta.currentPage + 1;
    }
  }

  if (meta.nextPage === meta.currentPage) {
    meta.itemsPerPage = currentLimit > total ? total : currentLimit;
  }

  return meta;
}

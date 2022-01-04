import {MetaPagination} from '../interfaces';

export function pageMetadata(pageDetail: number[]): MetaPagination {
  const [pageNumber, pageLimit, totalData] = pageDetail;

  if (!totalData) {
    return {
      totalItemCount: 0,
      totalPageCount: 0,
      itemsPerPage: 0,
    };
  }

  let pageIndex = 1;
  let pageSize = 5;

  if (!isNaN(pageNumber) && pageNumber > 0) pageIndex = pageNumber;
  if (!isNaN(pageLimit) && pageLimit > 0) pageSize = pageLimit;

  const totalItemCount = totalData;
  const itemsPerPage = pageSize > totalData ? totalData : pageSize;
  const totalPageCount = Math.ceil(totalItemCount / itemsPerPage);

  const meta: MetaPagination = {
    totalItemCount,
    totalPageCount,
    itemsPerPage,
  };

  if (pageIndex <= meta.totalPageCount) {
    meta.currentPage = pageIndex;

    if (pageIndex !== 1) {
      meta.previousPage = pageIndex - 1;
    }

    if (pageIndex !== meta.totalPageCount) {
      meta.nextPage = meta.currentPage + 1;
    }
  }

  if (meta.nextPage === meta.currentPage) {
    meta.itemsPerPage = pageSize > totalData ? totalData : pageSize;
  }

  return meta;
}

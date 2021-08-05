export interface MetaPagination {
  totalItemCount: number;
  totalPageCount: number;
  itemsPerPage: number;
  currentPage?: number;
  nextPage?: number;
  previousPage?: number;
}

const ROW_HEIGHT_ESTIMATE = 56;
const MIN_PAGE = 10;
const MAX_PAGE = 100;

export function pageSizeFor(viewportHeight: number): number {
  const rows = Math.ceil(viewportHeight / ROW_HEIGHT_ESTIMATE);
  return Math.min(MAX_PAGE, Math.max(MIN_PAGE, rows));
}

export function currentPageSize(): number {
  return pageSizeFor(typeof window === "undefined" ? 0 : window.innerHeight);
}

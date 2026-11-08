export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalPages: number;
}

const MAX_PAGE_SIZE = 100;

/** Cuts a list into one page; page numbers start at 1 and the size is capped at 100. */
export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  const size = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * size;
  return {
    items: items.slice(start, start + size),
    page: current,
    pageSize: size,
    totalPages,
  };
}

export function buildPageLinks(basePath: string, page: Page<unknown>): string[] {
  const links: string[] = [];
  if (page.page > 1) links.push(`${basePath}?page=${page.page - 1}`);
  if (page.page < page.totalPages) links.push(`${basePath}?page=${page.page + 1}`);
  return links;
}

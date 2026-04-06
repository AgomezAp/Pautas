export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function parsePagination(query: any): PaginationParams {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '25', 10)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function buildPaginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

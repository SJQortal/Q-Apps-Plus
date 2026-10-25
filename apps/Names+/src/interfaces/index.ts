export enum Availability {
  NULL = 'null',
  LOADING = 'loading',
  INVALID = 'invalid',
  AVAILABLE = 'available',
  NOT_AVAILABLE = 'not-available',
}

export type SortDirection = 'asc' | 'desc';
export type SortBy = 'name' | 'salePrice' | 'length' | 'registered';

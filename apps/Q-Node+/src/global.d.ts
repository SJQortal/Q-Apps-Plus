interface QortalRequestOptions {
  action: string;
  name?: string;
  service?: string;
  data64?: string;
  title?: string;
  description?: string;
  category?: string;
  tags?: string[] | string;
  identifier?: string;
  address?: string;
  metaData?: string;
  encoding?: string;
  includeMetadata?: boolean;
  limit?: number;
  offset?: number;
  reverse?: boolean;
  resources?: unknown[];
  filename?: string;
  list_name?: string;
  item?: string;
  items?: string[];
  tag1?: string;
  tag2?: string;
  tag3?: string;
  tag4?: string;
  tag5?: string;
  coin?: string;
  destinationAddress?: string;
  amount?: number | number;
  recipient?: string;
  fee?: number | string;
  blob?: Blob;
  mimeType?: string;
  file?: File;
  encryptedData?: string;
  mode?: string;
  query?: string;
  excludeBlocked?: boolean;
  exactMatchNames?: boolean;
  creationBytes?: string;
  type?: string;
  host?: string;
  port?: number;
  assetId?: number;
  confirmationStatus?: string;
  startBlock?: number;
  blockLimit?: number;
  txGroupId?: number;
  memo?: string;
  value?: string | number | boolean;
}

// Hub's API is untyped; each caller narrows the result it needs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare function qortalRequest(options: QortalRequestOptions): Promise<any>;

declare function qortalRequestWithTimeout(
  options: QortalRequestOptions,
  time: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any>;

declare global {
  interface Window {
    _qdnBase: string;
    _qdnTheme: string;
  }
}

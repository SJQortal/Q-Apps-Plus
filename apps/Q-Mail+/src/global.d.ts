// src/global.d.ts
interface QortalRequestOptions {
  action: string;
  name?: string;
  service?: string;
  data64?: string;
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  identifier?: string;
  address?: string;
  metaData?: string;
  encoding?: string;
  includeMetadata?: boolean;
  limit?: numebr;
  offset?: number;
  reverse?: boolean;
  resources?: any[];
  filename?: string;
  list_name?: string;
  item?: string;
  items?: strings[];
  tag1?: string;
  tag2?: string;
  tag3?: string;
  tag4?: string;
  tag5?: string;
  coin?: string;
  destinationAddress?: string;
  amount?: number;
  blob?: Blob;
  mimeType?: string;
  mode?: string;
  txGroupId?: string | number;
  after?: number;
  before?: number;
  groupId?: string | number;
  message?: string;
  query?: string;
  prefix?: boolean;
  qortalLink?: string;
  notificationIds?: string[];
  encrypt?: boolean;
  publicKeys?: string[];
}

declare function qortalRequest(options: QortalRequestOptions): Promise<any>;
declare function qortalRequestWithTimeout(
  options: QortalRequestOptions,
  time: number
): Promise<any>;

declare global {
  interface Window {
    _qdnBase: any; // Replace 'any' with the appropriate type if you know it
    _qdnTheme: string;
  }
}

declare global {
  interface Window {
    showSaveFilePicker: (
      options?: SaveFilePickerOptions
    ) => Promise<FileSystemFileHandle>;
  }
}

declare module "quill-image-resize-module-react" {}

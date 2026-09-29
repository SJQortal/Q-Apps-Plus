// src/global.d.ts

type TransactionType =
  | "GENESIS"
  | "PAYMENT"
  | "REGISTER_NAME"
  | "UPDATE_NAME"
  | "SELL_NAME"
  | "CANCEL_SELL_NAME"
  | "BUY_NAME"
  | "CREATE_POLL"
  | "VOTE_ON_POLL"
  | "ARBITRARY"
  | "ISSUE_ASSET"
  | "TRANSFER_ASSET"
  | "CREATE_ASSET_ORDER"
  | "CANCEL_ASSET_ORDER"
  | "MULTI_PAYMENT"
  | "DEPLOY_AT"
  | "MESSAGE"
  | "CHAT"
  | "PUBLICIZE"
  | "AIRDROP"
  | "AT"
  | "CREATE_GROUP"
  | "UPDATE_GROUP"
  | "ADD_GROUP_ADMIN"
  | "REMOVE_GROUP_ADMIN"
  | "GROUP_BAN"
  | "CANCEL_GROUP_BAN"
  | "GROUP_KICK"
  | "GROUP_INVITE"
  | "CANCEL_GROUP_INVITE"
  | "JOIN_GROUP"
  | "LEAVE_GROUP"
  | "GROUP_APPROVAL"
  | "SET_GROUP"
  | "UPDATE_ASSET"
  | "ACCOUNT_FLAGS"
  | "ENABLE_FORGING"
  | "REWARD_SHARE"
  | "ACCOUNT_LEVEL"
  | "TRANSFER_PRIVS"
  | "PRESENCE";

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
  resources?: any[];
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
  amount?: number;
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
  assetId?: number;
  txType?: TransactionType[];
  confirmationStatus?: string;
  startBlock?: number;
  blockLimit?: number;
  txGroupId?: number;
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

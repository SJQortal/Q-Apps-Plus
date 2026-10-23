/**
 * Shapes of the Core API responses Q-Node+ reads. Field names match the
 * Qortal Core JSON exactly (ground rule 1 in CLAUDE.md); optional fields are
 * ones older cores leave out.
 */

/** `/admin/info`, via `GET_NODE_INFO`. */
export interface NodeInfo {
  currentTimestamp?: number;
  uptime?: number;
  buildVersion?: string;
  buildTimestamp?: number;
  nodeId?: string;
  isTestNet?: boolean;
  type?: string;
}

/** `/admin/status`, via `GET_NODE_STATUS`. */
export interface NodeStatus {
  isMintingPossible?: boolean;
  isSynchronizing?: boolean;
  syncPercent?: number;
  numberOfConnections?: number;
  numberOfDataConnections?: number;
  height?: number;
}

/** The merged info + status object the dashboard shows. */
export type NodeData = NodeInfo & NodeStatus;

/** One row of `/peers`. */
export interface Peer {
  address: string;
  age?: string;
  connectedWhen?: number;
  connectionId?: string;
  direction?: string;
  handshakeStatus?: string;
  isTooDivergent?: boolean;
  lastBlockSignature?: string;
  lastBlockTimestamp?: number;
  lastHeight?: number;
  lastPing?: number;
  nodeId?: string;
  peersConnectedWhen?: number;
  version?: string;
}

/** One row of `/peers/data` (the QDN data network). */
export interface DataPeer {
  address?: string;
  age?: string;
  direction?: string;
  handshakeStatus?: string;
  version?: string;
}

/** One row of `ADMIN_ACTION getmintingaccounts` (`/admin/mintingaccounts`). */
export interface MintingAccountRaw {
  publicKey: string;
  mintingAccount: string;
  recipientAccount: string;
}

/** A minting account after the name lookup. */
export interface MintingAccount extends MintingAccountRaw {
  name: string | null;
  avatar: string | null;
}

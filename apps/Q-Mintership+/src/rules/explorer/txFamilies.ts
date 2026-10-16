/**
 * Qortal's transaction types in families, for the Explorer's filters
 * (an account's Transactions tab and Transactions on Qortal), and each type
 * in plain words. The list is Core's own enum (Transaction.TransactionType,
 * Core 6.1.4–6.1.9): every type belongs to exactly one family, and a type
 * Core adds later lands in Other until it is placed here.
 */

/** Every transaction type Core knows, in Core's order (type numbers 1–41). */
export const ALL_TX_TYPES = [
  'GENESIS',
  'PAYMENT',
  'REGISTER_NAME',
  'UPDATE_NAME',
  'SELL_NAME',
  'CANCEL_SELL_NAME',
  'BUY_NAME',
  'CREATE_POLL',
  'VOTE_ON_POLL',
  'ARBITRARY',
  'ISSUE_ASSET',
  'TRANSFER_ASSET',
  'CREATE_ASSET_ORDER',
  'CANCEL_ASSET_ORDER',
  'MULTI_PAYMENT',
  'DEPLOY_AT',
  'MESSAGE',
  'CHAT',
  'PUBLICIZE',
  'AIRDROP',
  'AT',
  'CREATE_GROUP',
  'UPDATE_GROUP',
  'ADD_GROUP_ADMIN',
  'REMOVE_GROUP_ADMIN',
  'GROUP_BAN',
  'CANCEL_GROUP_BAN',
  'GROUP_KICK',
  'GROUP_INVITE',
  'CANCEL_GROUP_INVITE',
  'JOIN_GROUP',
  'LEAVE_GROUP',
  'GROUP_APPROVAL',
  'SET_GROUP',
  'UPDATE_ASSET',
  'ACCOUNT_FLAGS',
  'ENABLE_FORGING',
  'REWARD_SHARE',
  'ACCOUNT_LEVEL',
  'TRANSFER_PRIVS',
  'PRESENCE',
] as const;

export type TxType = (typeof ALL_TX_TYPES)[number];

export type TxFamilyKey =
  'all' | 'payments' | 'names' | 'minting' | 'groups' | 'qdn' | 'trading' | 'messages' | 'other';

export interface TxFamily {
  key: TxFamilyKey;
  label: string;
  /** The types in this family. Empty for All: no type filter at all. */
  types: readonly TxType[];
}

/** The filters, in the order they show. */
export const TX_FAMILIES: readonly TxFamily[] = [
  { key: 'all', label: 'All', types: [] },
  { key: 'payments', label: 'Payments', types: ['PAYMENT', 'TRANSFER_ASSET', 'MULTI_PAYMENT'] },
  {
    key: 'names',
    label: 'Names',
    types: ['REGISTER_NAME', 'UPDATE_NAME', 'SELL_NAME', 'CANCEL_SELL_NAME', 'BUY_NAME'],
  },
  {
    key: 'minting',
    label: 'Minting',
    types: ['REWARD_SHARE', 'TRANSFER_PRIVS', 'ACCOUNT_FLAGS', 'ACCOUNT_LEVEL', 'ENABLE_FORGING'],
  },
  {
    key: 'groups',
    label: 'Groups',
    types: [
      'CREATE_GROUP',
      'UPDATE_GROUP',
      'ADD_GROUP_ADMIN',
      'REMOVE_GROUP_ADMIN',
      'GROUP_BAN',
      'CANCEL_GROUP_BAN',
      'GROUP_KICK',
      'GROUP_INVITE',
      'CANCEL_GROUP_INVITE',
      'JOIN_GROUP',
      'LEAVE_GROUP',
      'GROUP_APPROVAL',
      'SET_GROUP',
    ],
  },
  { key: 'qdn', label: 'QDN data', types: ['ARBITRARY'] },
  {
    key: 'trading',
    label: 'Trading',
    types: [
      'DEPLOY_AT',
      'AT',
      'CREATE_ASSET_ORDER',
      'CANCEL_ASSET_ORDER',
      'ISSUE_ASSET',
      'UPDATE_ASSET',
    ],
  },
  { key: 'messages', label: 'Messages', types: ['MESSAGE', 'CHAT'] },
  {
    key: 'other',
    label: 'Other',
    types: ['GENESIS', 'CREATE_POLL', 'VOTE_ON_POLL', 'PUBLICIZE', 'AIRDROP', 'PRESENCE'],
  },
];

const FAMILY_BY_TYPE: ReadonlyMap<string, TxFamilyKey> = new Map(
  TX_FAMILIES.flatMap((family) => family.types.map((type) => [type, family.key] as const))
);

/** The family a type belongs to; Other for a type this app doesn't know. Never All. */
export function familyOf(type: string): Exclude<TxFamilyKey, 'all'> {
  return (FAMILY_BY_TYPE.get(type) ?? 'other') as Exclude<TxFamilyKey, 'all'>;
}

/** The types to ask Core for. Empty for All (or an unknown key): no type filter. */
export function typesFor(familyKey: string): readonly TxType[] {
  return TX_FAMILIES.find((family) => family.key === familyKey)?.types ?? [];
}

/** Is this a family key (for example from a URL parameter)? */
export function isTxFamilyKey(value: unknown): value is TxFamilyKey {
  return typeof value === 'string' && TX_FAMILIES.some((family) => family.key === value);
}

/** Each type in plain words: the title of its row and of its own page. */
export const TX_TYPE_LABELS: Readonly<Record<TxType, string>> = {
  GENESIS: 'Genesis allocation',
  PAYMENT: 'Payment',
  REGISTER_NAME: 'Name registration',
  UPDATE_NAME: 'Name update',
  SELL_NAME: 'Name listed for sale',
  CANCEL_SELL_NAME: 'Name sale cancelled',
  BUY_NAME: 'Name purchase',
  CREATE_POLL: 'Poll created',
  VOTE_ON_POLL: 'Poll vote',
  ARBITRARY: 'QDN publish',
  ISSUE_ASSET: 'Asset issued',
  TRANSFER_ASSET: 'Asset transfer',
  CREATE_ASSET_ORDER: 'Asset order',
  CANCEL_ASSET_ORDER: 'Asset order cancelled',
  MULTI_PAYMENT: 'Multi-payment',
  DEPLOY_AT: 'AT created',
  MESSAGE: 'Message',
  CHAT: 'Chat message',
  PUBLICIZE: 'Public key published',
  AIRDROP: 'Airdrop',
  AT: 'AT transaction',
  CREATE_GROUP: 'Group created',
  UPDATE_GROUP: 'Group update',
  ADD_GROUP_ADMIN: 'Group admin added',
  REMOVE_GROUP_ADMIN: 'Group admin removed',
  GROUP_BAN: 'Group ban',
  CANCEL_GROUP_BAN: 'Group ban lifted',
  GROUP_KICK: 'Removal from a group',
  GROUP_INVITE: 'Group invite',
  CANCEL_GROUP_INVITE: 'Group invite cancelled',
  JOIN_GROUP: 'Joining a group',
  LEAVE_GROUP: 'Leaving a group',
  GROUP_APPROVAL: 'Group approval',
  SET_GROUP: 'Default group set',
  UPDATE_ASSET: 'Asset update',
  ACCOUNT_FLAGS: 'Account flags',
  ENABLE_FORGING: 'Enable forging',
  REWARD_SHARE: 'Reward share',
  ACCOUNT_LEVEL: 'Account level',
  TRANSFER_PRIVS: 'Minting level move',
  PRESENCE: 'Presence',
};

/** A type in words: its label, or Core's name in sentence case for a type this app doesn't know. */
export function txTypeLabel(type: string): string {
  const known = (TX_TYPE_LABELS as Record<string, string>)[type];
  if (known) return known;
  const words = String(type ?? '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .trim();
  return words ? words[0].toUpperCase() + words.slice(1) : 'Transaction';
}

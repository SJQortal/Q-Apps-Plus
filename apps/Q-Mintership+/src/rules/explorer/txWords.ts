/**
 * One transaction in plain words, for the Explorer: a title (its type), a
 * sentence told from the account whose page it is ("Sent 15 QORT to Bob",
 * "Received 15 QORT from Ann", or "Ann paid Bob 15 QORT" with no
 * viewpoint), the accounts involved, and the type's own fields for an
 * expanded row.
 *
 * The sentence is a list of parts, so the page renders accounts, names,
 * groups and transactions as links (names isolated with `<bdi>`); `plain`
 * is the same sentence as text, for copying and labels.
 *
 * What is never said: a message's content (not even an unencrypted one);
 * the identifier or anything else inside an encrypted QDN resource; and
 * the fields only the raw JSON shows (`txGroupId`, `timeToLive` and the
 * like). Pure: no reads.
 */
import { APPROVAL_GATED_TYPES, type TxRow } from '../../data/types';
import { MINTER_GROUP_ID, NULL_OWNER } from '../../data/constants';
import { shortAddress } from '../../utils/format';
import { visibleName } from './nameNotes';
import { isPrivateService, serviceName, serviceWords } from './qdnServices';
import { txTypeLabel } from './txFamilies';

export type TxPart =
  | { kind: 'text'; text: string }
  | { kind: 'account'; address: string }
  | { kind: 'amount'; amount: string; asset: string }
  | { kind: 'name'; name: string }
  | { kind: 'group'; groupId: number }
  | { kind: 'tx'; signature: string };

export interface TxField {
  label: string;
  value: string | TxPart;
}

export interface TxWords {
  /** The type in words ("Payment"). */
  title: string;
  /** The sentence. */
  parts: TxPart[];
  /** The sentence as plain text, accounts as short addresses. */
  plain: string;
  /**
   * From the viewpoint: `out` = it made this and another account is
   * involved; `in` = another account made it and it involves this one;
   * `self` = it made this and no other account is involved; `none` = no
   * viewpoint, or the viewpoint isn't involved.
   */
  direction: 'in' | 'out' | 'self' | 'none';
  /** Every account involved, the one that made it first (an AT's own address for an AT). */
  participants: string[];
  /** The type's own fields in plain words, for an expanded row. */
  fields: TxField[];
}

export interface TxWordsOptions {
  /** The account whose page this is. */
  viewpoint?: string | null;
  /** A minting-level move's recipient, read from its raw bytes (Core's JSON leaves it out). */
  privsRecipient?: string | null;
}

// ---- formatting --------------------------------------------------------------

const ADDRESS_RE = /^[QA][1-9A-HJ-NP-Za-km-z]{33}$/;

function isAccount(value: unknown): value is string {
  return typeof value === 'string' && ADDRESS_RE.test(value);
}

/** "4.30000000" → "4.3", "637557960.49687541" → "637,557,960.49687541". */
export function formatAmount(value: unknown): string {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) return raw || '0';
  const [, sign, int, frac = ''] = match;
  const whole = int.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimals = frac.replace(/0+$/, '');
  return `${sign}${whole}${decimals ? `.${decimals}` : ''}`;
}

const ATOMIC = 100_000_000n;

function toAtomic(value: unknown): bigint | null {
  const match = String(value ?? '')
    .trim()
    .match(/^(\d+)(?:\.(\d{1,8}))?$/);
  if (!match) return null;
  return BigInt(match[1]) * ATOMIC + BigInt((match[2] ?? '').padEnd(8, '0'));
}

function fromAtomic(value: bigint): string {
  return formatAmount(`${value / ATOMIC}.${(value % ATOMIC).toString().padStart(8, '0')}`);
}

/** QORT for asset 0 (or none given), else the asset's name, else "asset #N". */
export function assetLabel(assetId: unknown, assetName?: unknown): string {
  const id = assetId === undefined || assetId === null ? 0 : Number(assetId);
  if (id === 0) return 'QORT';
  if (typeof assetName === 'string' && assetName.trim()) return assetName;
  return `asset #${Number.isFinite(id) ? id : String(assetId)}`;
}

/** A group in plain text: MINTER, or "group #1195". */
export function groupWords(groupId: number): string {
  return groupId === MINTER_GROUP_ID ? 'MINTER' : `group #${groupId}`;
}

/** "0 %", "5.5 %". */
function percentWords(value: unknown): string {
  return `${formatAmount(String(value ?? '0'))} %`;
}

/** "240 bytes", "1.2 KB", "3.4 MB". */
function sizeWords(bytes: number): string {
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1).replace(/\.0$/, '')} ${units[unit]}`;
}

function partText(part: TxPart): string {
  switch (part.kind) {
    case 'text':
      return part.text;
    case 'account':
      return shortAddress(part.address);
    case 'amount':
      return `${part.amount} ${part.asset}`;
    case 'name':
      return `“${visibleName(part.name)}”`;
    case 'group':
      return groupWords(part.groupId);
    case 'tx':
      return `transaction ${part.signature.slice(0, 8)}…`;
  }
}

/** The parts as one line of text ("Created the group #1195", not "the group group #1195"). */
export function partsToPlain(parts: TxPart[]): string {
  return parts
    .map((part, i) => {
      const before = parts[i - 1];
      if (
        part.kind === 'group' &&
        part.groupId !== MINTER_GROUP_ID &&
        before?.kind === 'text' &&
        /\bgroup $/i.test(before.text)
      )
        return `#${part.groupId}`;
      return partText(part);
    })
    .join('');
}

// ---- building sentences --------------------------------------------------------

type Piece = string | TxPart | null | undefined | false;

const account = (address: string): TxPart => ({ kind: 'account', address });
const amountOf = (amount: unknown, asset: string): TxPart => ({
  kind: 'amount',
  amount: formatAmount(amount),
  asset,
});
const nameOf = (name: string): TxPart => ({ kind: 'name', name });
const txOf = (signature: string): TxPart => ({ kind: 'tx', signature });

function build(pieces: Piece[]): TxPart[] {
  const parts: TxPart[] = [];
  for (const piece of pieces) {
    if (piece === null || piece === undefined || piece === false || piece === '') continue;
    const part: TxPart = typeof piece === 'string' ? { kind: 'text', text: piece } : piece;
    const last = parts[parts.length - 1];
    if (part.kind === 'text' && last?.kind === 'text') last.text += part.text;
    else parts.push(part.kind === 'text' ? { ...part } : part);
  }
  return parts;
}

const capitalize = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text);

interface Ctx {
  tx: TxRow;
  /** The viewpoint, when there is one. */
  me: string | null;
  /** Who made it (an AT's own address; null for Core's own genesis account). */
  actor: string | null;
  /** The viewpoint made it. */
  mine: boolean;
}

/** "Sent …" when the viewpoint made it, "Ann sent …" otherwise. */
function act(c: Ctx, verb: string, ...rest: Piece[]): Piece[] {
  if (c.mine) return [capitalize(verb), ...rest];
  return [c.actor ? account(c.actor) : 'An account', ` ${verb}`, ...rest];
}

/** An account as the object of a sentence: "this account" when it is the viewpoint. */
function obj(c: Ctx, address: unknown): Piece {
  if (!isAccount(address)) return 'an account';
  return address === c.me ? 'this account' : account(address);
}

function group(groupId: unknown): Piece {
  return typeof groupId === 'number' && Number.isFinite(groupId)
    ? { kind: 'group', groupId }
    : 'a group';
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function positive(amount: unknown): boolean {
  const atomic = toAtomic(amount);
  return atomic !== null && atomic > 0n;
}

const yesNo = (value: unknown) => (value ? 'Yes' : 'No');

interface Built {
  pieces: Piece[];
  /** Falsy entries are left out. */
  fields?: Array<TxField | null | false | '' | undefined>;
  /** The accounts it involves besides the one that made it. */
  others?: unknown[];
  /** Overrides the direction worked out from the accounts. */
  direction?: TxWords['direction'];
}

const field = (label: string, value: unknown): TxField | null => {
  if (value === null || value === undefined || value === '') return null;
  return { label, value: typeof value === 'object' ? (value as TxPart) : String(value) };
};

// ---- group approval --------------------------------------------------------------

type Unfinished = 'PENDING' | 'REJECTED' | 'EXPIRED' | 'INVALID';

const UNFINISHED_SUFFIX: Record<Unfinished, string> = {
  PENDING: ' (waiting for group approval)',
  REJECTED: ' (rejected in group approval)',
  EXPIRED: ' (not approved in time)',
  INVALID: ' (not valid)',
};

const APPROVAL_WORDS: Record<string, string> = {
  PENDING: 'Waiting for approvals',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EXPIRED: 'Not approved in time',
  INVALID: 'Not valid',
};

function unfinished(tx: TxRow): Unfinished | null {
  const status = tx.approvalStatus;
  return status === 'PENDING' ||
    status === 'REJECTED' ||
    status === 'EXPIRED' ||
    status === 'INVALID'
    ? status
    : null;
}

const GATED: ReadonlySet<string> = new Set([...APPROVAL_GATED_TYPES, 'UPDATE_GROUP']);

/** "invited " once it happened, "proposed to invite " while it waits for (or failed) group approval. */
function verb(c: Ctx, past: string, base: string): string {
  return GATED.has(c.tx.type) && unfinished(c.tx) ? `proposed to ${base}` : past;
}

// ---- each type ---------------------------------------------------------------------

/** PAYMENT, TRANSFER_ASSET and the like: `noneVerb` reads "[A] paid [B] [amount]". */
function transfer(c: Ctx, recipient: unknown, amount: TxPart, none: 'paid' | 'sent'): Piece[] {
  const to = isAccount(recipient) ? recipient : null;
  if (to && to === c.actor) return act(c, 'sent ', amount, ' to itself');
  if (c.mine) return ['Sent ', amount, ' to ', obj(c, to)];
  if (to && to === c.me)
    return ['Received ', amount, ' from ', c.actor ? account(c.actor) : 'an account'];
  return none === 'paid'
    ? [c.actor ? account(c.actor) : 'An account', ' paid ', obj(c, to), ' ', amount]
    : [c.actor ? account(c.actor) : 'An account', ' sent ', amount, ' to ', obj(c, to)];
}

function payments(
  tx: TxRow
): Array<{ recipient: string; amount: string; asset: string; assetId: number }> {
  const rows = Array.isArray(tx.payments) ? (tx.payments as Array<Record<string, unknown>>) : [];
  return rows
    .filter((row) => row && isAccount(row.recipient))
    .map((row) => ({
      recipient: row.recipient as string,
      amount: String(row.amount ?? '0'),
      assetId: Number(row.assetId ?? 0),
      asset: assetLabel(row.assetId ?? 0, row.assetName),
    }));
}

/** Totals per asset ("12 QORT", "5 asset #90"), in first-seen order. */
function totals(rows: Array<{ amount: string; asset: string }>): TxPart[] {
  const sums = new Map<string, bigint>();
  for (const row of rows)
    sums.set(row.asset, (sums.get(row.asset) ?? 0n) + (toAtomic(row.amount) ?? 0n));
  return [...sums].map(([asset, sum]) => ({ kind: 'amount', amount: fromAtomic(sum), asset }));
}

function joinAmounts(amounts: TxPart[]): Piece[] {
  return amounts.flatMap((amount, i) => (i === 0 ? [amount] : [' and ', amount]));
}

function paymentFields(rows: ReturnType<typeof payments>): TxField[] {
  return rows.map((row) => ({
    label: `${formatAmount(row.amount)} ${row.asset} to`,
    value: account(row.recipient),
  }));
}

function multiPayment(c: Ctx): Built {
  const rows = payments(c.tx);
  const recipients = [...new Set(rows.map((row) => row.recipient))];
  const count = `${recipients.length} ${recipients.length === 1 ? 'account' : 'accounts'}`;
  const all = joinAmounts(totals(rows));
  let pieces: Piece[];
  if (c.mine) pieces = ['Paid ', count, ' ', ...all, ' in one payment'];
  else if (c.me && recipients.includes(c.me)) {
    const mine = joinAmounts(totals(rows.filter((row) => row.recipient === c.me)));
    pieces = [
      'Received ',
      ...mine,
      ' from ',
      c.actor ? account(c.actor) : 'an account',
      recipients.length > 1 ? ` (one of ${recipients.length} in a payment)` : '',
    ];
  } else pieces = act(c, `paid ${count} `, ...all, ' in one payment');
  return { pieces, fields: paymentFields(rows), others: recipients };
}

function rewardShare(c: Ctx): Built {
  const { tx } = c;
  const recipient = isAccount(tx.recipient) ? tx.recipient : null;
  const removal = Number(tx.sharePercent) < 0;
  const fields = [
    recipient && recipient !== c.actor ? field('Recipient', account(recipient)) : null,
    field('Share', removal ? 'Removed' : percentWords(tx.sharePercent)),
  ];
  if (recipient && recipient === c.actor)
    return {
      pieces: removal
        ? act(c, 'stopped minting (removed its self-share)')
        : act(c, 'started minting (a self-share)'),
      fields,
      others: [recipient],
    };
  let pieces: Piece[];
  if (!c.mine && recipient && recipient === c.me)
    pieces = removal
      ? [c.actor ? account(c.actor) : 'An account', ' removed its reward share with this account']
      : [
          c.actor ? account(c.actor) : 'An account',
          ` started a reward share with this account at ${percentWords(tx.sharePercent)}`,
        ];
  else
    pieces = removal
      ? act(c, 'removed the reward share with ', obj(c, recipient))
      : act(
          c,
          'started a reward share with ',
          obj(c, recipient),
          ` at ${percentWords(tx.sharePercent)}`
        );
  return { pieces, fields, others: [recipient] };
}

function transferPrivs(c: Ctx, privsRecipient: string | null | undefined): Built {
  const recipient = isAccount(privsRecipient)
    ? privsRecipient
    : isAccount(c.tx.recipient)
      ? c.tx.recipient
      : null;
  let pieces: Piece[];
  if (!c.mine && recipient && recipient === c.me)
    pieces = ['Got its minting level from ', c.actor ? account(c.actor) : 'an account'];
  else
    pieces = recipient
      ? act(c, 'moved its minting level to ', obj(c, recipient))
      : act(c, 'moved its minting level to another account');
  return {
    pieces,
    fields: [recipient ? field('Moved to', account(recipient)) : null],
    others: [recipient],
    direction: c.mine ? 'out' : undefined,
  };
}

function buyName(c: Ctx): Built {
  const { tx } = c;
  const name = str(tx.name);
  const seller = isAccount(tx.seller) ? tx.seller : null;
  const price = amountOf(tx.amount, 'QORT');
  let pieces: Piece[];
  if (!c.mine && seller && seller === c.me)
    pieces = [
      'Sold the name ',
      nameOf(name),
      ' to ',
      c.actor ? account(c.actor) : 'an account',
      ' for ',
      price,
    ];
  else
    pieces = act(
      c,
      'bought the name ',
      nameOf(name),
      seller ? ' from ' : '',
      seller ? obj(c, seller) : '',
      ' for ',
      price
    );
  return {
    pieces,
    fields: [
      field('Name', nameOf(name)),
      field('Price', price),
      seller && field('Seller', account(seller)),
    ],
    others: [seller],
  };
}

function updateName(c: Ctx): Built {
  const { tx } = c;
  const name = str(tx.name);
  const newName = str(tx.newName);
  const renamed = Boolean(newName) && newName !== name;
  return {
    pieces: renamed
      ? act(c, 'renamed ', nameOf(name), ' to ', nameOf(newName))
      : act(c, 'updated the name ', nameOf(name), "'s details"),
    fields: [
      field('Name', nameOf(name)),
      renamed && field('New name', nameOf(newName)),
      field('New data', str(tx.newData)),
    ],
  };
}

function arbitrary(c: Ctx): Built {
  const { tx } = c;
  const service = serviceName(tx.service);
  const name = str(tx.name);
  const encrypted = isPrivateService(service);
  const rows = payments(tx);
  const recipients = [...new Set(rows.map((row) => row.recipient))];
  const what = encrypted ? 'an encrypted resource' : serviceWords(service);
  let pieces: Piece[];
  if (!c.mine && c.me && recipients.includes(c.me))
    pieces = [
      'Received ',
      ...joinAmounts(totals(rows.filter((row) => row.recipient === c.me))),
      ' from ',
      c.actor ? account(c.actor) : 'an account',
      ' with a QDN publish',
    ];
  else pieces = act(c, `published ${what}`, name ? ' as ' : '', name ? nameOf(name) : '');
  if (encrypted)
    // Counts only: nothing that tells what is inside, not even its identifier.
    return { pieces, fields: [field('Service', service)], others: recipients };
  const identifier = str(tx.identifier);
  const size = typeof tx.size === 'number' && tx.size >= 0 ? sizeWords(tx.size) : '';
  return {
    pieces,
    fields: [
      field('Service', service),
      name && field('Name', nameOf(name)),
      field('Identifier', identifier),
      field('Size', size),
      ...paymentFields(rows),
    ],
    others: recipients,
  };
}

function message(c: Ctx, what: 'a message' | 'a chat message'): Built {
  const { tx } = c;
  const recipient = isAccount(tx.recipient) ? tx.recipient : null;
  const amount = positive(tx.amount) ? amountOf(tx.amount, assetLabel(tx.assetId)) : null;
  let pieces: Piece[];
  if (!c.mine && recipient && recipient === c.me)
    pieces = [
      `Received ${what}`,
      amount ? ' with ' : '',
      amount,
      ' from ',
      c.actor ? account(c.actor) : 'an account',
    ];
  else
    pieces = act(
      c,
      `sent ${what}`,
      amount ? ' with ' : '',
      amount,
      recipient ? ' to ' : '',
      recipient ? obj(c, recipient) : ''
    );
  // Whether it was encrypted, never what it said.
  return { pieces, fields: [field('Encrypted', yesNo(tx.isEncrypted))], others: [recipient] };
}

function at(c: Ctx): Built {
  const { tx } = c;
  const recipient = isAccount(tx.recipient) ? tx.recipient : null;
  const atAddress = isAccount(tx.atAddress) ? tx.atAddress : null;
  const amount = positive(tx.amount) ? amountOf(tx.amount, assetLabel(tx.assetId)) : null;
  const from = atAddress ? account(atAddress) : 'an AT';
  let pieces: Piece[];
  if (amount && recipient) pieces = transfer(c, recipient, amount, 'paid');
  else if (recipient && !c.mine && recipient === c.me) pieces = ['Received a message from ', from];
  else if (recipient) pieces = act(c, 'sent a message to ', obj(c, recipient));
  else pieces = act(c, 'ran');
  return {
    pieces,
    fields: [atAddress && field('AT (automated contract)', account(atAddress))],
    others: [recipient],
  };
}

function deployAt(c: Ctx): Built {
  const { tx } = c;
  const atAddress = isAccount(tx.aTAddress)
    ? tx.aTAddress
    : isAccount(tx.atAddress)
      ? tx.atAddress
      : null;
  const pieces =
    !c.mine && atAddress && atAddress === c.me
      ? [c.actor ? account(c.actor) : 'An account', ' created this AT (automated contract)']
      : act(c, 'created an AT (automated contract)');
  return {
    pieces,
    fields: [
      field('AT name', str(tx.name)),
      field('Description', str(tx.description)),
      field('Kind', str(tx.aTType)),
      field('Tags', str(tx.tags)),
      atAddress && field('AT address', account(atAddress)),
      positive(tx.amount) && field('Funded with', amountOf(tx.amount, assetLabel(tx.assetId))),
    ],
    others: [atAddress],
  };
}

function groupFields(c: Ctx, subjectLabel: string | null, subject: unknown): Array<TxField | null> {
  return [
    typeof c.tx.groupId === 'number'
      ? field('Group', { kind: 'group', groupId: c.tx.groupId })
      : null,
    subjectLabel && isAccount(subject) ? field(subjectLabel, account(subject)) : null,
  ];
}

function groupTx(c: Ctx): Built {
  const { tx } = c;
  const g = group(tx.groupId);
  switch (tx.type) {
    case 'GROUP_INVITE':
      return {
        pieces: act(c, verb(c, 'invited ', 'invite '), obj(c, tx.invitee), ' to ', g),
        fields: groupFields(c, 'Invitee', tx.invitee),
        others: [tx.invitee],
      };
    case 'CANCEL_GROUP_INVITE': {
      const invitee = isAccount(tx.invitee) ? tx.invitee : null;
      const known = typeof tx.groupId === 'number';
      const did = verb(c, 'cancelled ', 'cancel ');
      const pieces =
        invitee && known
          ? act(c, did, 'the invite to ', g, ' for ', obj(c, invitee))
          : known
            ? act(c, did, 'an invite to ', g)
            : invitee
              ? act(c, did, 'a group invite for ', obj(c, invitee))
              : act(c, did, 'a group invite');
      return { pieces, fields: groupFields(c, 'Invitee', invitee), others: [invitee] };
    }
    case 'GROUP_KICK':
      return {
        pieces: act(c, verb(c, 'removed ', 'remove '), obj(c, tx.member), ' from ', g),
        fields: [...groupFields(c, 'Member', tx.member), field('Reason', str(tx.reason))],
        others: [tx.member],
      };
    case 'GROUP_BAN':
      return {
        pieces: act(c, verb(c, 'banned ', 'ban '), obj(c, tx.offender), ' from ', g),
        fields: [...groupFields(c, 'Account', tx.offender), field('Reason', str(tx.reason))],
        others: [tx.offender],
      };
    case 'CANCEL_GROUP_BAN':
      return {
        pieces: act(c, verb(c, 'lifted ', 'lift '), obj(c, tx.member), "'s ban from ", g),
        fields: groupFields(c, 'Account', tx.member),
        others: [tx.member],
      };
    case 'ADD_GROUP_ADMIN': {
      const self = isAccount(tx.member) && tx.member === c.actor;
      return {
        pieces: self
          ? act(c, verb(c, 'became an admin of ', 'become an admin of '), g)
          : act(c, verb(c, 'made ', 'make '), obj(c, tx.member), ' an admin of ', g),
        fields: groupFields(c, 'New admin', tx.member),
        others: [tx.member],
      };
    }
    case 'REMOVE_GROUP_ADMIN': {
      const self = isAccount(tx.admin) && tx.admin === c.actor;
      return {
        pieces: self
          ? act(c, verb(c, 'stepped down as an admin of ', 'step down as an admin of '), g)
          : act(c, verb(c, 'removed ', 'remove '), obj(c, tx.admin), ' as an admin of ', g),
        fields: groupFields(c, 'Admin', tx.admin),
        others: [tx.admin],
      };
    }
    case 'JOIN_GROUP':
      // Joined at once, or only asked: that depends on the group and on what
      // came before (data/timeline.ts works it out for MINTER), not on this row.
      return { pieces: act(c, 'joined or asked to join ', g), fields: groupFields(c, null, null) };
    case 'LEAVE_GROUP':
      return { pieces: act(c, 'left ', g), fields: groupFields(c, null, null) };
    case 'CREATE_GROUP':
      return {
        pieces: act(c, 'created the group ', g),
        fields: [
          ...groupFields(c, null, null),
          field('Name', str(tx.groupName)),
          field('Description', str(tx.description)),
          typeof tx.isOpen === 'boolean' && field('Open to anyone', yesNo(tx.isOpen)),
        ],
      };
    case 'UPDATE_GROUP': {
      const newOwner = isAccount(tx.newOwner) ? tx.newOwner : null;
      const handover = newOwner !== null && newOwner !== c.actor;
      return {
        pieces: handover
          ? act(c, verb(c, 'made ', 'make '), obj(c, newOwner), ' the owner of ', g)
          : act(c, verb(c, 'updated the settings of ', 'update the settings of '), g),
        fields: [
          ...groupFields(c, null, null),
          handover && field('New owner', account(newOwner)),
          field('New description', str(tx.newDescription)),
          typeof tx.newIsOpen === 'boolean' && field('Open to anyone', yesNo(tx.newIsOpen)),
        ],
        others: [newOwner],
      };
    }
    case 'SET_GROUP': {
      const id = Number(tx.defaultGroupId);
      return {
        pieces:
          Number.isFinite(id) && id > 0
            ? act(c, 'set its default group to ', group(id))
            : act(c, 'cleared its default group'),
        fields: [],
      };
    }
    case 'GROUP_APPROVAL': {
      const target = str(tx.pendingSignature);
      return {
        pieces: act(
          c,
          tx.approval ? 'approved ' : 'rejected ',
          target ? txOf(target) : 'a transaction'
        ),
        fields: [
          field('Answer', tx.approval ? 'Approve' : 'Reject'),
          target && field('Transaction', txOf(target)),
        ],
      };
    }
    default:
      return { pieces: [] };
  }
}

function genesisSuffix(tx: TxRow): string {
  return tx.blockHeight === 1 ? ' in the genesis block' : '';
}

function accountFlags(c: Ctx): Built {
  const { tx } = c;
  const target = isAccount(tx.target) ? tx.target : null;
  let pieces: Piece[];
  if (c.actor) pieces = act(c, 'set the account flags of ', obj(c, target));
  else if (target && target === c.me) pieces = [`Its account flags were set${genesisSuffix(tx)}`];
  else pieces = ['The account flags of ', obj(c, target), ` were set${genesisSuffix(tx)}`];
  return {
    pieces,
    fields: [
      target && field('Account', account(target)),
      field('Change', `and ${tx.andMask ?? '?'}, or ${tx.orMask ?? '?'}, xor ${tx.xorMask ?? '?'}`),
    ],
    others: [target],
  };
}

function accountLevel(c: Ctx): Built {
  const { tx } = c;
  const target = isAccount(tx.target) ? tx.target : null;
  const level = Number(tx.level);
  const to = ` to ${Number.isFinite(level) ? level : '?'}`;
  let pieces: Piece[];
  if (c.actor) pieces = act(c, 'set the level of ', obj(c, target), to);
  else if (target && target === c.me) pieces = [`Its level was set${to}${genesisSuffix(tx)}`];
  else pieces = ['The level of ', obj(c, target), ` was set${to}${genesisSuffix(tx)}`];
  return {
    pieces,
    fields: [
      target && field('Account', account(target)),
      field('Level', Number.isFinite(level) ? level : ''),
    ],
    others: [target],
  };
}

function genesis(c: Ctx): Built {
  const { tx } = c;
  const recipient = isAccount(tx.recipient) ? tx.recipient : null;
  const amount = amountOf(tx.amount, assetLabel(tx.assetId, tx.assetName));
  const pieces: Piece[] =
    recipient && recipient === c.me
      ? ['Received ', amount, ' in the genesis block']
      : [obj(c, recipient), ' received ', amount, ' in the genesis block'];
  return {
    pieces: pieces.map((p, i) => (i === 0 && p === 'an account' ? 'An account' : p)),
    others: [recipient],
  };
}

function createPoll(c: Ctx): Built {
  const { tx } = c;
  const owner = isAccount(tx.owner) ? tx.owner : null;
  const poll = `“${str(tx.pollName)}”`;
  const options = Array.isArray(tx.pollOptions)
    ? (tx.pollOptions as Array<{ optionName?: unknown }>)
        .map((option) => str(option?.optionName))
        .filter(Boolean)
    : [];
  return {
    pieces:
      owner && owner !== c.actor
        ? act(c, `created the poll ${poll} owned by `, obj(c, owner))
        : act(c, `created the poll ${poll}`),
    fields: [
      field('Poll', str(tx.pollName)),
      field('Description', str(tx.description)),
      options.length > 0 && field('Options', options.join(', ')),
      owner && owner !== c.actor && field('Owner', account(owner)),
    ],
    others: [owner],
  };
}

function voteOnPoll(c: Ctx): Built {
  const { tx } = c;
  const index = Number(tx.optionIndex);
  return {
    pieces: act(c, `voted on the poll “${str(tx.pollName)}”`),
    fields: [
      field('Poll', str(tx.pollName)),
      // Counted from 1; the page may look the option's words up from the poll.
      Number.isInteger(index) && index >= 0 && field('Option', `Option ${index + 1}`),
    ],
  };
}

function issueAsset(c: Ctx): Built {
  const { tx } = c;
  const name = str(tx.assetName);
  return {
    pieces: name ? act(c, `issued the asset “${name}”`) : act(c, 'issued an asset'),
    fields: [
      typeof tx.assetId === 'number' && field('Asset', `#${tx.assetId}`),
      field('Quantity', tx.quantity !== undefined ? formatAmount(tx.quantity) : ''),
      typeof tx.isDivisible === 'boolean' && field('Divisible', yesNo(tx.isDivisible)),
      field('Description', str(tx.description)),
    ],
  };
}

function createAssetOrder(c: Ctx): Built {
  const { tx } = c;
  const have = assetLabel(tx.haveAssetId, tx.haveAssetName);
  const want = assetLabel(tx.wantAssetId, tx.wantAssetName);
  const amountAsset = assetLabel(
    tx.amountAssetId ?? tx.haveAssetId,
    tx.amountAssetName ?? tx.haveAssetName
  );
  return {
    pieces: act(c, `placed an order to trade ${have} for ${want}`),
    fields: [
      tx.amount !== undefined && field('Amount', amountOf(tx.amount, amountAsset)),
      tx.price !== undefined &&
        field(
          'Price',
          `${formatAmount(tx.price)}${str(tx.pricePair) ? ` ${str(tx.pricePair)}` : ''}`
        ),
    ],
  };
}

function updateAsset(c: Ctx): Built {
  const { tx } = c;
  const asset = typeof tx.assetId === 'number' ? `asset #${tx.assetId}` : 'an asset';
  const newOwner = isAccount(tx.newOwner) ? tx.newOwner : null;
  const handover = newOwner !== null && newOwner !== c.actor;
  return {
    pieces: handover ? act(c, `gave ${asset} to `, obj(c, newOwner)) : act(c, `updated ${asset}`),
    fields: [
      handover && field('New owner', account(newOwner)),
      field('New description', str(tx.newDescription)),
    ],
    others: [newOwner],
  };
}

function unknownType(c: Ctx): Built {
  const type = String(c.tx.type || 'unknown');
  const article = /^[AEIOU]/i.test(type) ? 'an' : 'a';
  return {
    pieces:
      c.actor && !c.mine
        ? [account(c.actor), ` made ${article} ${type} transaction`]
        : [`${capitalize(article)} ${type} transaction`],
  };
}

function describe(c: Ctx, options: TxWordsOptions): Built {
  const { tx } = c;
  switch (tx.type) {
    case 'PAYMENT': {
      const amount = amountOf(tx.amount, 'QORT');
      return {
        pieces: transfer(c, tx.recipient, amount, 'paid'),
        fields: [
          field('Amount', amount),
          isAccount(tx.recipient) && field('Recipient', account(tx.recipient)),
        ],
        others: [tx.recipient],
      };
    }
    case 'TRANSFER_ASSET': {
      const amount = amountOf(tx.amount, assetLabel(tx.assetId, tx.assetName));
      return {
        pieces: transfer(c, tx.recipient, amount, 'sent'),
        fields: [
          field('Amount', amount),
          typeof tx.assetId === 'number' && tx.assetId !== 0 && field('Asset', `#${tx.assetId}`),
          isAccount(tx.recipient) && field('Recipient', account(tx.recipient)),
        ],
        others: [tx.recipient],
      };
    }
    case 'MULTI_PAYMENT':
      return multiPayment(c);
    case 'REWARD_SHARE':
      return rewardShare(c);
    case 'TRANSFER_PRIVS':
      return transferPrivs(c, options.privsRecipient);
    case 'BUY_NAME':
      return buyName(c);
    case 'SELL_NAME':
      return {
        pieces: act(
          c,
          'listed the name ',
          nameOf(str(tx.name)),
          ' for sale at ',
          amountOf(tx.amount, 'QORT')
        ),
        fields: [field('Name', nameOf(str(tx.name))), field('Price', amountOf(tx.amount, 'QORT'))],
      };
    case 'CANCEL_SELL_NAME':
      return {
        pieces: act(c, 'took the name ', nameOf(str(tx.name)), ' off sale'),
        fields: [field('Name', nameOf(str(tx.name)))],
      };
    case 'REGISTER_NAME':
      return {
        pieces: act(c, 'registered the name ', nameOf(str(tx.name))),
        fields: [field('Name', nameOf(str(tx.name))), field('Data', str(tx.data))],
      };
    case 'UPDATE_NAME':
      return updateName(c);
    case 'ARBITRARY':
      return arbitrary(c);
    case 'MESSAGE':
      return message(c, 'a message');
    case 'CHAT':
      return message(c, 'a chat message');
    case 'AT':
      return at(c);
    case 'DEPLOY_AT':
      return deployAt(c);
    case 'GROUP_INVITE':
    case 'CANCEL_GROUP_INVITE':
    case 'GROUP_KICK':
    case 'GROUP_BAN':
    case 'CANCEL_GROUP_BAN':
    case 'ADD_GROUP_ADMIN':
    case 'REMOVE_GROUP_ADMIN':
    case 'JOIN_GROUP':
    case 'LEAVE_GROUP':
    case 'CREATE_GROUP':
    case 'UPDATE_GROUP':
    case 'SET_GROUP':
    case 'GROUP_APPROVAL':
      return groupTx(c);
    case 'ACCOUNT_FLAGS':
      return accountFlags(c);
    case 'ACCOUNT_LEVEL':
      return accountLevel(c);
    case 'GENESIS':
      return genesis(c);
    case 'CREATE_POLL':
      return createPoll(c);
    case 'VOTE_ON_POLL':
      return voteOnPoll(c);
    case 'PUBLICIZE':
      return { pieces: act(c, 'published its public key (PUBLICIZE)') };
    case 'ISSUE_ASSET':
      return issueAsset(c);
    case 'CREATE_ASSET_ORDER':
      return createAssetOrder(c);
    case 'CANCEL_ASSET_ORDER':
      return {
        pieces: act(c, 'cancelled an asset order'),
        fields: [str(tx.orderId) && field('Order', txOf(str(tx.orderId)))],
      };
    case 'UPDATE_ASSET':
      return updateAsset(c);
    case 'AIRDROP':
      return { pieces: act(c, 'made an airdrop') };
    case 'ENABLE_FORGING': {
      const target = isAccount(tx.target) ? tx.target : null;
      return {
        pieces: target ? act(c, 'enabled forging for ', obj(c, target)) : act(c, 'enabled forging'),
        others: [target],
      };
    }
    case 'PRESENCE':
      return {
        pieces: act(
          c,
          tx.presenceType === 'TRADE_BOT'
            ? 'showed it is online (trade bot)'
            : 'showed it is online (minting)'
        ),
      };
    default:
      return unknownType(c);
  }
}

/** Who made it: an AT's own address for an AT; nobody for Core's genesis account. */
function actorOf(tx: TxRow): string | null {
  if (tx.type === 'AT') return isAccount(tx.atAddress) ? tx.atAddress : null;
  const creator = tx.creatorAddress;
  return isAccount(creator) && creator !== NULL_OWNER ? creator : null;
}

/** One transaction in words, told from `options.viewpoint` when given. */
export function describeTx(tx: TxRow, options: TxWordsOptions = {}): TxWords {
  const me = isAccount(options.viewpoint) ? options.viewpoint : null;
  const actor = actorOf(tx);
  const c: Ctx = { tx, me, actor, mine: me !== null && me === actor };
  const built = describe(c, options);
  const outcome = unfinished(tx);
  const parts = build([...built.pieces, outcome ? UNFINISHED_SUFFIX[outcome] : '']);

  const others = [
    ...new Set(
      (built.others ?? []).filter(
        (address): address is string =>
          isAccount(address) && address !== NULL_OWNER && address !== actor
      )
    ),
  ];
  const participants = actor ? [actor, ...others] : others;
  let direction: TxWords['direction'] = 'none';
  if (me && c.mine) direction = others.length > 0 ? 'out' : 'self';
  else if (me && others.includes(me)) direction = 'in';
  if (built.direction && me) direction = built.direction;

  const approval =
    tx.approvalStatus && tx.approvalStatus !== 'NOT_REQUIRED'
      ? field('Group approval', APPROVAL_WORDS[tx.approvalStatus] ?? tx.approvalStatus)
      : null;
  const fields = [...(built.fields ?? []), approval].filter((f): f is TxField => Boolean(f));

  return {
    title: txTypeLabel(tx.type),
    parts,
    plain: partsToPlain(parts),
    direction,
    participants,
    fields,
  };
}

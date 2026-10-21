/**
 * The account report (Simon, 2026-10-21: one button for everything known on
 * chain about an account and its connections, saved as a human-readable,
 * transparent .md file). Plain Markdown with the same headings every time,
 * so reports of different accounts read and compare alike:
 *
 * 1. a header table: the account, when and at which block it was made, how
 *    much of its history was read, and with which app;
 * 2. the neutral line (what these facts are and aren't);
 * 3. Account: its facts as Core gives them;
 * 4. QORT totals (only from its whole history);
 * 5. Activity by type;
 * 6. Connections: each kind as sentences with block, date and signature,
 *    payments as tables, then what was checked and found nothing;
 * 7. Core's sponsorship report;
 * 8. What was read, and what couldn't be;
 * 9. the transactions behind the connections, with full signatures.
 *
 * Facts only, in the Explorer's own words: nothing here adds a verdict.
 * Every time is UTC. Pure: data/explorer/accountReport.ts gathers it.
 */
import type { TxRow } from '../../data/types';
import type { AccountInfo } from '../../data/types';
import type { FirstSeen, GroupOf, OnlineShare } from '../../data/explorer/account';
import type { SponsorshipReport } from '../../data/explorer/sponsorship';
import type { ExchangeFlow } from './exchanges';
import type { Finding, FindingKind } from './findings';
import { partsText } from './findings';
import { formatAtomic, type AssetSum } from './money';
import { sponsorReportLines } from './connections';
import { txTypeLabel } from './txFamilies';
import { formatCount, plural } from '../../utils/format';

export interface QortTotals {
  /** Null when it can't be worked out; undefined when it wasn't (no whole history). */
  minted?: bigint | null;
  neverMinted?: boolean;
  received?: bigint;
  sent?: bigint;
  /** On the Trade Portal. */
  bought?: bigint;
  sold?: bigint;
}

export interface AccountReportData {
  address: string;
  /** When it was made (ms). */
  madeAt: number;
  tip: { height: number; timestamp: number } | null;
  app: { name: string; version: string; link: string };
  neutralLine: string;
  /** Null when Core couldn't be read; 'unused' for an address no transaction ever touched. */
  account: AccountInfo | 'unused' | null;
  balance: bigint | null;
  primaryName: string | null;
  names: { names: string[]; truncated: boolean } | null;
  groups: GroupOf[] | null;
  /** Its reward shares that mint now (from the online list). */
  minting: OnlineShare[] | null;
  firstSeen: FirstSeen | null;
  /** What of its history was read: every transaction, or its newest `rows.length`. */
  history: { rows: TxRow[]; done: boolean } | null;
  findings: Finding[];
  /** "Also checked, nothing found: …", or null. */
  nothingFound: string | null;
  sponsorReport: SponsorshipReport | null;
  /** The other accounts its sponsor made reward shares to. */
  sameSponsor: { sponsor: string; others: string[]; truncated: boolean } | null;
  exchanges: ExchangeFlow[] | null;
  qort: QortTotals | null;
  /** What was read, one line each ("Read: every QORT payment it sent (12)…"). */
  coverage: string[];
  /** What couldn't be read ("Core's sponsorship report"). */
  failed: string[];
  /** Names already read, for the accounts it mentions. */
  nameOf: (address: string) => string | null | undefined;
}

/** "2026-10-21 14:03 UTC". */
export function utc(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** "2026-10-21". */
const day = (ms: number) => utc(ms).slice(0, 10);

/** A table cell: no line breaks, pipes escaped. */
function cell(value: string | number): string {
  return String(value).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

function table(
  head: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number>>
): string[] {
  return [
    `| ${head.map(cell).join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ];
}

const code = (text: string) => `\`${text}\``;

/** "igorcoin (`QZwf…`)": an account with its name when known, the address always whole. */
function accountWords(address: string, nameOf: AccountReportData['nameOf']): string {
  const name = nameOf(address);
  return name ? `${name} (${code(address)})` : code(address);
}

function qort(atomic: bigint): string {
  return `${formatAtomic(atomic)} QORT`;
}

function assetsWords(assets: readonly AssetSum[] | undefined): string {
  return (assets ?? []).map((sum) => `${formatAtomic(sum.atomic)} ${sum.asset}`).join(', ');
}

/** The account's display title. */
export function reportTitle(data: Pick<AccountReportData, 'address' | 'primaryName'>): string {
  return data.primaryName ? `${data.primaryName}` : data.address;
}

/** "account-report-igorcoin-2026-10-21.md": letters, digits, - and _ only. */
export function reportFilename(
  data: Pick<AccountReportData, 'address' | 'primaryName' | 'madeAt'>
): string {
  const who = (data.primaryName ?? data.address)
    .normalize('NFKD')
    // Accents apart, then dropped: "Ünïcode" becomes "Unicode".
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `account-report-${who || data.address}-${day(data.madeAt)}.md`;
}

/** How much of its history was read, in words. */
export function historyWords(history: AccountReportData['history']): string {
  if (!history) return 'its history couldn’t be read';
  return history.done
    ? `its whole on-chain history (${plural(history.rows.length, 'transaction')})`
    : `only its newest ${formatCount(history.rows.length)} transactions (not its whole history)`;
}

function headerLines(data: AccountReportData): string[] {
  return [
    `# Account report: ${reportTitle(data)}`,
    '',
    ...table(
      ['', ''],
      [
        ['Address', code(data.address)],
        ['Primary name', data.primaryName ?? 'none'],
        [
          'Made',
          `${utc(data.madeAt)}${data.tip ? `, at block ${formatCount(data.tip.height)}` : ''}`,
        ],
        ['Read from', historyWords(data.history)],
        ['Made with', `${data.app.name} ${data.app.version}`],
        ['Open it', data.app.link],
      ]
    ),
    '',
    `> ${data.neutralLine}`,
  ];
}

function minterGroup(groups: GroupOf[] | null): string {
  if (!groups) return 'couldn’t be read';
  const minter = groups.find((group) => group.groupId === 694);
  if (!minter) return 'not a member';
  return minter.isAdmin ? 'member, Minter Admin' : 'member';
}

function accountLines(data: AccountReportData): string[] {
  const out = ['', '## Account', ''];
  if (data.account === 'unused') {
    out.push('Core has never seen this address: no transaction ever involved it.');
    return out;
  }
  if (!data.account) {
    out.push('Core’s record of this account couldn’t be read.');
    return out;
  }
  const a = data.account;
  const rows: Array<[string, string]> = [
    ['Public key', a.publicKey ? code(a.publicKey) : 'none yet (it has never sent a transaction)'],
    ['Level', String(a.level)],
    [
      'Blocks minted',
      `${formatCount(a.blocksMinted)} (adjustment ${formatCount(a.blocksMintedAdjustment)}, penalty ${formatCount(a.blocksMintedPenalty)})`,
    ],
    ['Balance', data.balance === null ? 'couldn’t be read' : qort(data.balance)],
    ['MINTER group (694)', minterGroup(data.groups)],
  ];
  if (data.minting)
    rows.push([
      'Minting now',
      data.minting.length
        ? data.minting
            .map((share) =>
              share.minterAddress === data.address && share.recipientAddress === data.address
                ? 'on its own key'
                : `with ${accountWords(share.minterAddress === data.address ? share.recipientAddress : share.minterAddress, data.nameOf)}`
            )
            .join('; ')
        : 'no',
    ]);
  if (data.names)
    rows.push([
      'Names',
      data.names.names.length
        ? `${formatCount(data.names.names.length)}${data.names.truncated ? '+' : ''}: ${data.names.names.join(', ')}`
        : 'none',
    ]);
  if (data.groups)
    rows.push([
      'Groups',
      data.groups.length
        ? `${formatCount(data.groups.length)}: ${data.groups
            .map(
              (group) => `${group.groupName} (#${group.groupId}${group.isAdmin ? ', admin' : ''})`
            )
            .join(', ')}`
        : 'none',
    ]);
  const seen = data.firstSeen;
  if (seen?.firstSeen)
    rows.push([
      'First seen on chain',
      `block ${formatCount(seen.firstSeen.height)}, ${utc(seen.firstSeen.timestamp)}`,
    ]);
  if (seen?.firstOwn)
    rows.push([
      'Its first own transaction',
      `${txTypeLabel(seen.firstOwn.type)}, block ${formatCount(seen.firstOwn.height)}, ${utc(seen.firstOwn.timestamp)}, ${code(seen.firstOwn.signature)}`,
    ]);
  if (seen?.funding)
    rows.push([
      'First received',
      `${seen.funding.amount ? `${seen.funding.amount.replace(/\.?0+$/, '')} ${seen.funding.assetId ? (seen.funding.assetName ?? `asset #${seen.funding.assetId}`) : 'QORT'} ` : ''}${seen.funding.from ? `from ${accountWords(seen.funding.from, data.nameOf)}` : 'in the genesis block'}, block ${formatCount(seen.funding.height)}, ${utc(seen.funding.timestamp)}, ${code(seen.funding.signature)}`,
    ]);
  out.push(...table(['Fact', 'Value'], rows));
  return out;
}

function qortLines(data: AccountReportData): string[] {
  const out = ['', '## QORT totals', ''];
  const q = data.qort;
  if (!q || !data.history?.done) {
    out.push(
      'These add up its whole history, which wasn’t read for this report: read all of it first to have them.'
    );
    return out;
  }
  const rows: Array<[string, string]> = [];
  rows.push([
    'Minted',
    q.neverMinted
      ? 'never minted'
      : q.minted === undefined
        ? 'not worked out'
        : q.minted === null
          ? 'can’t be worked out (its transactions don’t add up to its balance)'
          : qort(q.minted),
  ]);
  if (q.received !== undefined) rows.push(['Received in payments and transfers', qort(q.received)]);
  if (q.sent !== undefined) rows.push(['Sent in payments and transfers', qort(q.sent)]);
  if (q.bought !== undefined) rows.push(['Bought on the Trade Portal', qort(q.bought)]);
  if (q.sold !== undefined) rows.push(['Sold on the Trade Portal', qort(q.sold)]);
  out.push(...table(['', 'QORT'], rows));
  out.push(
    '',
    'Minted is its balance now less what its transactions moved; the rest reached it without a transaction of its own (minting rewards, which include fees paid to minters and the online Minter Admins’ and Dev Admins’ share).'
  );
  return out;
}

function activityLines(data: AccountReportData): string[] {
  const out = ['', '## Activity by type', ''];
  const rows = data.history?.rows ?? [];
  if (!rows.length) {
    out.push(data.history ? 'No transactions.' : 'Its transactions couldn’t be read.');
    return out;
  }
  const by = new Map<string, { count: number; first: number; last: number }>();
  for (const tx of rows) {
    const type = String(tx.type ?? 'UNKNOWN');
    const entry = by.get(type) ?? { count: 0, first: tx.timestamp, last: tx.timestamp };
    entry.count += 1;
    entry.first = Math.min(entry.first, tx.timestamp);
    entry.last = Math.max(entry.last, tx.timestamp);
    by.set(type, entry);
  }
  out.push(
    `From ${historyWords(data.history)}.`,
    '',
    ...table(
      ['Type', 'Transactions', 'First', 'Last'],
      [...by.entries()]
        .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
        .map(([type, entry]) => [
          txTypeLabel(type),
          formatCount(entry.count),
          day(entry.first),
          day(entry.last),
        ])
    )
  );
  return out;
}

const GROUPS: ReadonlyArray<{ title: string; kinds: readonly FindingKind[] }> = [
  { title: 'Minting level moved', kinds: ['levelMove'] },
  { title: 'Reward shares', kinds: ['sponsor', 'mintingWith', 'sponsees'] },
  { title: 'Names bought or sold', kinds: ['nameDeal'] },
  { title: 'Asset trades', kinds: ['traded'] },
];

/** " (block 1,371,641, 2025-05-14, `4Kw5…`)" or " (blocks 1,364,500–2,100,000, 2023-01-02 to 2025-05-14, 6 transactions, newest `4Kw5…`)". */
function whereWords(finding: Finding): string {
  if (!finding.height) return '';
  const several = finding.firstHeight !== undefined && finding.firstHeight !== finding.height;
  const when =
    several && finding.firstTimestamp
      ? `${day(finding.firstTimestamp)} to ${day(finding.timestamp)}`
      : day(finding.timestamp);
  const blocks = several
    ? `blocks ${formatCount(finding.firstHeight as number)}–${formatCount(finding.height)}`
    : `block ${formatCount(finding.height)}`;
  const count = finding.count ? `, ${formatCount(finding.count)} transactions` : '';
  return ` (${blocks}, ${when}${count}, ${several ? 'newest ' : ''}${code(finding.signature)})`;
}

function sentence(finding: Finding, nameOf: AccountReportData['nameOf']): string {
  return partsText(finding.parts, nameOf).replace(/\.$/, '');
}

function flowRows(
  findings: readonly Finding[],
  nameOf: AccountReportData['nameOf']
): Array<Array<string | number>> {
  return findings.map((finding) => [
    finding.other ? code(finding.other) : '',
    (finding.other && nameOf(finding.other)) || '',
    formatCount(finding.count ?? finding.evidence.length),
    finding.qort ? formatAtomic(finding.qort) : '0',
    assetsWords(finding.assets),
    finding.firstTimestamp ? day(finding.firstTimestamp) : day(finding.timestamp),
    day(finding.timestamp),
  ]);
}

function connectionLines(data: AccountReportData): string[] {
  const out = ['', '## Connections'];
  for (const group of GROUPS) {
    const found = data.findings.filter((finding) => group.kinds.includes(finding.kind));
    if (!found.length) continue;
    out.push('', `### ${group.title}`, '');
    for (const finding of found)
      out.push(`- ${sentence(finding, data.nameOf)}${whereWords(finding)}`);
  }
  const head = ['Account', 'Name', 'Payments', 'QORT', 'Other assets', 'First', 'Last'];
  const received = data.findings.filter((finding) => finding.kind === 'paidBy');
  const sent = data.findings.filter((finding) => finding.kind === 'paidTo');
  if (received.length)
    out.push('', '### Payments received from', '', ...table(head, flowRows(received, data.nameOf)));
  if (sent.length)
    out.push('', '### Payments sent to', '', ...table(head, flowRows(sent, data.nameOf)));
  const exchanges = (data.exchanges ?? []).filter((flow) => flow.rows.length);
  if (exchanges.length)
    out.push(
      '',
      '### QORT to and from known exchange accounts',
      '',
      ...table(
        ['Exchange', 'Account', 'Way', 'Payments', 'QORT'],
        exchanges.map((flow) => [
          flow.exchange,
          code(flow.address),
          flow.direction === 'sent' ? 'sent to it' : 'received from it',
          `${formatCount(flow.rows.length)}${flow.more ? '+' : ''}`,
          formatAtomic(flow.qort),
        ])
      )
    );
  const same = data.sameSponsor;
  if (same) {
    out.push('', '### Sponsored by the same account', '');
    const listed = same.others.slice(0, 200);
    out.push(
      same.others.length
        ? `Its sponsor, ${accountWords(same.sponsor, data.nameOf)}, also made reward shares to ${plural(same.others.length, 'other account')}${same.truncated ? ' (in its newest reward shares)' : ''}:`
        : `Its sponsor, ${accountWords(same.sponsor, data.nameOf)}, made reward shares to no other account${same.truncated ? ' in its newest reward shares' : ''}.`
    );
    if (listed.length) {
      out.push('');
      for (const other of listed) out.push(`- ${accountWords(other, data.nameOf)}`);
      if (same.others.length > listed.length)
        out.push(`- and ${formatCount(same.others.length - listed.length)} more`);
    }
  }
  if (data.nothingFound) out.push('', data.nothingFound);
  if (!data.findings.length && !data.nothingFound)
    out.push('', 'Nothing recorded between it and other accounts was read.');
  return out;
}

function sponsorLines(data: AccountReportData): string[] {
  const out = ['', '## Core’s sponsorship report', ''];
  if (!data.sponsorReport) {
    out.push(
      data.failed.includes('Core’s sponsorship report')
        ? 'Core’s sponsorship report couldn’t be read.'
        : 'Not read.'
    );
    return out;
  }
  out.push(...sponsorReportLines(data.sponsorReport).map((line) => `- ${line}`));
  return out;
}

function readLines(data: AccountReportData): string[] {
  const out = ['', '## What was read', ''];
  out.push(`- Its transactions: ${historyWords(data.history)}.`);
  for (const line of data.coverage) out.push(`- ${line}`);
  if (data.failed.length) out.push(`- Couldn’t be read: ${data.failed.join(', ')}.`);
  out.push(
    '- Every fact comes from a Qortal node’s public API: account, names, groups, transactions, the online list, Core’s sponsorship report and Q-Asset orders. Nothing was written.'
  );
  return out;
}

/** The transactions behind the connections, at most this many listed. */
export const EVIDENCE_MAX = 2000;

function evidenceLines(data: AccountReportData): string[] {
  const seen = new Map<string, TxRow>();
  for (const finding of data.findings)
    for (const tx of finding.evidence) if (!seen.has(tx.signature)) seen.set(tx.signature, tx);
  const rows = [...seen.values()].sort(
    (a, b) => (b.blockHeight ?? 0) - (a.blockHeight ?? 0) || b.timestamp - a.timestamp
  );
  const out = ['', '## Transactions behind the connections', ''];
  if (!rows.length) {
    out.push('None.');
    return out;
  }
  const listed = rows.slice(0, EVIDENCE_MAX);
  out.push(
    ...table(
      ['Block', 'Time', 'Type', 'From', 'Signature'],
      listed.map((tx) => [
        tx.blockHeight ? formatCount(tx.blockHeight) : 'unconfirmed',
        utc(tx.timestamp),
        txTypeLabel(String(tx.type)),
        typeof tx.creatorAddress === 'string' ? code(tx.creatorAddress) : '',
        code(tx.signature),
      ])
    )
  );
  if (rows.length > listed.length)
    out.push(
      '',
      `The newest ${formatCount(listed.length)} of ${formatCount(rows.length)} are listed.`
    );
  return out;
}

/** The whole report, as Markdown. */
export function accountReportMarkdown(data: AccountReportData): string {
  return [
    ...headerLines(data),
    ...accountLines(data),
    ...qortLines(data),
    ...activityLines(data),
    ...connectionLines(data),
    ...sponsorLines(data),
    ...readLines(data),
    ...evidenceLines(data),
    '',
  ].join('\n');
}

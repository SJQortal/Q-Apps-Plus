/**
 * Everything the account report says (rules/explorer/accountReport.ts),
 * read with the account page's own keys, so what the page has read already
 * costs nothing again: Core's record, balance, names, groups, the online
 * list, where it was first seen, its links, payments, asset transfers and
 * trades, the exchanges, Core's sponsorship report (1 to 5 seconds), and
 * with its whole history read, the QORT totals. The history itself is what
 * the page has read (`xtx:<a>:all`): the report says how much that was.
 *
 * Each part that fails is named, never taken for "none". The names of the
 * accounts it mentions are read 4 at a time, at most NAME_READS; past that
 * an account shows by its address alone. Nothing here writes.
 */
import { APP_VERSION } from '../../constants/app';
import { APP_NAME } from '../../constants/plus';
import { getAccount, getPrimaryName } from '../accounts';
import { getTip } from '../chain';
import { peekQuery } from '../query';
import {
  exploreAccount,
  getFirstSeen,
  getGroupsOf,
  getNamesOf,
  getOnline,
  onlineSharesOf,
} from './account';
import { accountTxKey, type AccountTxList } from './accountTx';
import { getLinks, LINK_PAGE, LINK_PAGES } from './links';
import { getAssetTransfers, getExchangePayments, getPayments } from './money';
import { getBalanceAtomic, getOrdersQort, getTradesQort } from './qortBook';
import { runPool } from './sets';
import { getSponsorshipReport } from './sponsorship';
import { getAccountTrades } from './trades';
import {
  emptyLinkChecks,
  linksOf,
  mintingWithNow,
  nothingFoundLine,
  type EmptyCheck,
} from '../../rules/explorer/connections';
import { formatCount } from '../../utils/format';
import { linksCoverage, recordedFindings } from '../../rules/explorer/findings';
import { flowsOf, paymentsCoverage } from '../../rules/explorer/money';
import { qortBook, qortMinted } from '../../rules/explorer/qortBook';
import { tradesCoverage } from '../../rules/explorer/trades';
import type { AccountReportData, QortTotals } from '../../rules/explorer/accountReport';
import { explorerAccountPath } from '../../routes/paths';
import { appLink } from '../../utils/links';

/** Names of the accounts it mentions read for one report, at most. */
export const NAME_READS = 500;

/** A part's answer, or null when it couldn't be read (named in `failed`). */
async function part<T>(label: string, failed: string[], read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    failed.push(label);
    return null;
  }
}

export async function gatherAccountReport(
  address: string,
  options: { neutralLine: string; onStage?: (words: string) => void }
): Promise<AccountReportData> {
  const failed: string[] = [];
  const stage = options.onStage ?? (() => undefined);
  stage('Reading its account');
  const [explored, tip, primaryName, names, groups, online, firstSeen] = await Promise.all([
    part('its account', failed, () => exploreAccount(address)),
    getTip().catch(() => null),
    getPrimaryName(address).catch(() => null),
    part('its names', failed, () => getNamesOf(address)),
    part('its groups', failed, () => getGroupsOf(address)),
    part('the online list', failed, () => getOnline()),
    part('where it was first seen', failed, () => getFirstSeen(address)),
  ]);
  const unused = explored?.kind === 'unused';

  stage('Reading its connections');
  const [links, sent, recv, assets, trades, exchanges] = unused
    ? [null, null, null, null, null, null]
    : await Promise.all([
        part('its reward shares, level moves and name sales', failed, () => getLinks(address)),
        part('its payments sent', failed, () => getPayments(address, 'sent')),
        part('its payments received', failed, () => getPayments(address, 'recv')),
        part('its asset transfers and multi-payments', failed, () => getAssetTransfers(address)),
        part('its asset trades', failed, () => getAccountTrades(address)),
        part('its payments to and from exchanges', failed, () => getExchangePayments(address)),
      ]);

  stage('Reading Core’s sponsorship report');
  const sponsorReport = unused
    ? null
    : await part('Core’s sponsorship report', failed, () => getSponsorshipReport(address));

  const list = peekQuery<AccountTxList>(accountTxKey(address, []));
  const history = list ? { rows: list.rows, done: list.done } : null;

  let qort: QortTotals | null = null;
  let balance: bigint | null = null;
  if (!unused) {
    stage('Reading its balance');
    balance = await part('its balance', failed, () => getBalanceAtomic(address));
    const account = explored?.kind === 'account' ? explored.account : null;
    const neverMinted = account
      ? account.blocksMinted + account.blocksMintedAdjustment <= 0
      : false;
    const portal = await part('its Trade Portal trades', failed, () => getTradesQort(address));
    qort = { neverMinted, ...(portal ? { bought: portal.bought, sold: portal.sold } : {}) };
    if (history?.done) {
      const book = qortBook(history.rows, address);
      qort.received = book.received;
      qort.sent = book.sent;
      if (!neverMinted && balance !== null) {
        const ordersNet = book.orders.length
          ? await part('its asset orders', failed, () => getOrdersQort(address, book.orders))
          : 0n;
        if (ordersNet !== null) {
          const value = qortMinted(balance, book, ordersNet);
          qort.minted = value < 0n ? null : value;
        }
      }
    }
  }

  const parsed = links ? linksOf(links.rows, address, links.privs) : null;
  // The other accounts its sponsor made reward shares to (its first sponsor, as the tab says).
  const sponsor = parsed?.sponsors[0]?.sponsor ?? null;
  const sponsorLinks = sponsor
    ? await part('its sponsor’s other sponsored accounts', failed, () => getLinks(sponsor))
    : null;
  const sameSponsor =
    sponsor && sponsorLinks
      ? {
          sponsor,
          others: linksOf(sponsorLinks.rows, sponsor, sponsorLinks.privs)
            .sponsees.map((sponsee) => sponsee.address)
            .filter((other) => other !== address),
          truncated: sponsorLinks.truncated,
        }
      : null;
  const minting = online ? onlineSharesOf(online, address) : null;
  const mintingWith = parsed && online ? mintingWithNow(parsed, address, online) : null;
  // The level now of each account it got its minting level from ("P is now level 0.").
  const levels: Record<string, number | undefined> = {};
  for (const move of parsed?.levelMoves ?? [])
    if (move.direction === 'from' && move.other)
      levels[move.other] = (await getAccount(move.other).catch(() => null))?.level;
  const findings = recordedFindings({
    links: parsed,
    mintingWith,
    sent: sent ? flowsOf([...sent.rows, ...(assets?.rows ?? [])], address, 'sent') : null,
    received: recv ? flowsOf([...recv.rows, ...(assets?.rows ?? [])], address, 'received') : null,
    trades: trades?.trades ?? null,
    levels,
  });
  // What was checked and found nothing, as the Connections tab says it: with the links read
  // to their ceiling, only level moves (read in full) and who mints with it now are claimed.
  const capped = links?.truncated === true;
  const pairedOnline = minting?.some((share) => share.minterAddress !== share.recipientAddress);
  const empty: EmptyCheck[] = [];
  const cappedEmpty: EmptyCheck[] = [];
  if (parsed)
    for (const check of emptyLinkChecks(parsed, mintingWith)) {
      if (!capped || check === 'levelMoves') empty.push(check);
      else if (check === 'mintingWith') {
        if (!pairedOnline) empty.push(check);
      } else cappedEmpty.push(check);
    }
  if (trades && !trades.trades.length) empty.push('assetTrades');
  if (sent && recv && assets && !findings.some((f) => f.kind === 'paidBy' || f.kind === 'paidTo'))
    empty.push('payments');
  if (firstSeen && !firstSeen.funding) empty.push('firstQort');
  const cappedLine = nothingFoundLine(cappedEmpty)?.replace(
    /^Also checked, nothing found: /,
    `In its newest ${formatCount(LINK_PAGE * LINK_PAGES)} reward shares, level moves and name sales, nothing found: `
  );

  const coverage: string[] = [];
  if (links) coverage.push(linksCoverage(links));
  if (sent && recv)
    coverage.push(
      paymentsCoverage(
        { count: sent.rows.length, done: sent.done },
        { count: recv.rows.length, done: recv.done },
        assets ? { count: assets.rows.length, truncated: assets.truncated } : undefined
      )
    );
  if (trades) coverage.push(tradesCoverage(trades));

  stage('Reading the names of its connections');
  const mentioned = [
    ...new Set(
      [
        ...findings.flatMap((f) => [
          f.other,
          ...f.parts.flatMap((p) => (p.kind === 'account' ? [p.address] : [])),
        ]),
        ...(minting ?? []).flatMap((share) => [share.minterAddress, share.recipientAddress]),
        firstSeen?.funding?.from,
        ...(sameSponsor ? [sameSponsor.sponsor, ...sameSponsor.others.slice(0, 200)] : []),
      ].filter((a): a is string => typeof a === 'string' && a !== address)
    ),
  ].slice(0, NAME_READS);
  await runPool(mentioned, 4, async (other) => {
    await getPrimaryName(other).catch(() => null);
  });
  const nameOf = (other: string) =>
    other === address ? primaryName : (peekQuery<string | null>(`name:${other}`) ?? null);

  return {
    address,
    madeAt: Date.now(),
    tip: tip ? { height: tip.height, timestamp: tip.timestamp } : null,
    app: {
      name: APP_NAME,
      version: APP_VERSION,
      link: appLink(explorerAccountPath(address, 'connections')),
    },
    neutralLine: options.neutralLine,
    account: unused ? 'unused' : explored?.kind === 'account' ? explored.account : null,
    balance,
    primaryName,
    names,
    groups,
    minting,
    firstSeen,
    history,
    findings,
    nothingFound: [nothingFoundLine(empty), cappedLine].filter(Boolean).join('\n\n') || null,
    sponsorReport,
    sameSponsor,
    exchanges,
    qort,
    coverage,
    failed,
    nameOf,
  };
}

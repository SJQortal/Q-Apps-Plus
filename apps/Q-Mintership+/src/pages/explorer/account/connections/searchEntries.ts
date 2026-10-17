/**
 * Connections' rows as the search sees them (Simon, 2026-10-17): what each
 * row shows (its sentence with the names known, when, how many
 * transactions, its plain tags) and the account it is about. One builder
 * per kind of row, so every list on the tab narrows the same way.
 */
import type { Funding } from '../../../../data/explorer/account';
import type { PayerBand } from '../../../../data/explorer/account';
import { fundingParts, siblingsParts } from '../../../../rules/explorer/connections';
import type { Finding } from '../../../../rules/explorer/findings';
import { flowCountWords, flowParts, type Flow } from '../../../../rules/explorer/money';
import { partsSearchText, type SearchNames } from '../../../../rules/explorer/searchText';
import { formatDate } from '../../../../utils/format';
import type { MatchStrength } from '../../../../utils/fuzzySearch';
import type { MintershipLink } from '../mintership/links';
import { blocksLine, whenLine } from './words';

export interface SearchEntry {
  text: string;
  accounts: Array<string | null>;
}

type Tags = ReadonlyArray<string | null | undefined>;

const joined = (pieces: ReadonlyArray<string | null | undefined>) =>
  pieces.filter((piece): piece is string => Boolean(piece)).join('\n');

/** A link recorded between them (a level move, a share, a name sale, the sponsees). */
export function findingEntry(finding: Finding, names: SearchNames, tags: Tags = []): SearchEntry {
  return {
    text: joined([
      partsSearchText(finding.parts, names),
      whenLine(finding),
      finding.evidenceWords,
      ...tags,
    ]),
    accounts: [finding.other],
  };
}

/** A payments row: the other account, sent to or received from. */
export function flowEntry(
  flow: Flow,
  direction: 'sent' | 'received',
  names: SearchNames,
  tags: Tags = []
): SearchEntry {
  return {
    text: joined([
      direction === 'sent' ? 'Sent to' : 'Received from',
      partsSearchText(flowParts(flow, direction), names),
      blocksLine(flow.first.height, flow.last.height),
      flowCountWords(flow),
      flow.isAt ? 'AT automated contract' : null,
      ...tags,
    ]),
    accounts: [flow.address],
  };
}

/** In common: where its first incoming transaction came from. */
export function fundingEntry(
  funding: Funding,
  band: PayerBand | undefined,
  names: SearchNames,
  tags: Tags = []
): SearchEntry {
  return {
    text: joined([
      partsSearchText(fundingParts(funding, band), names),
      formatDate(funding.timestamp),
      `block ${funding.height}`,
      ...tags,
    ]),
    accounts: [funding.from],
  };
}

/** In common: the sponsor it shares with others. */
export function siblingsEntry(
  sponsor: string,
  siblings: number,
  span: string,
  names: SearchNames,
  tags: Tags = []
): SearchEntry {
  return {
    text: joined([partsSearchText(siblingsParts(sponsor, siblings), names), span, ...tags]),
    accounts: [sponsor],
  };
}

/** In Q-Mintership: a nomination, a support or a vote between them. */
export function mintershipEntry(link: MintershipLink, heading: string): SearchEntry {
  return {
    text: joined([
      heading,
      link.vote ? `Voted ${link.vote === 'yes' ? 'Yes' : 'No'}` : null,
      link.round !== null ? `Round ${link.round}` : null,
      formatDate(link.at),
    ]),
    accounts: [link.other],
  };
}

/** Items split by how the search finds them: matches, then those only similar. */
export interface Found<T> {
  match: T[];
  similar: T[];
  /** Both, matches first. */
  all: T[];
}

/** Split `items` by `find` (null: not found, left out). */
export function splitFound<T>(
  items: readonly T[],
  find: (item: T) => MatchStrength | null
): Found<T> {
  const match: T[] = [];
  const similar: T[] = [];
  for (const item of items) {
    const found = find(item);
    if (found === 'match') match.push(item);
    else if (found === 'similar') similar.push(item);
  }
  return { match, similar, all: [...match, ...similar] };
}

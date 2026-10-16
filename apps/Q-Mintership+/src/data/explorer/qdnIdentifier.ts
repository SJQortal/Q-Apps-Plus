/**
 * QDN resources by an identifier pasted into the Explorer's search: Core's
 * exact match (`/arbitrary/resources/searchsimple?identifier=…&prefix=false`,
 * newest first, one page of IDENTIFIER_HITS + 1 so a fuller list says so).
 * Each row carries its publisher's name and the signature of its latest
 * transaction, which the search opens. No bodies are read. Key
 * `xqdnid:<identifier>`, cached 3 minutes like every QDN search.
 */
import { searchQdn } from '../qdn';
import { fetchQuery } from '../query';
import type { QdnRow } from '../types';

/** Resources listed at most for one identifier. */
export const IDENTIFIER_HITS = 10;
/** QDN's own longest identifier. */
export const IDENTIFIER_MAX_LENGTH = 64;

/** Text that could be a QDN identifier: no spaces, 3 to 64 characters. */
export function couldBeIdentifier(text: string): boolean {
  return text.length >= 3 && text.length <= IDENTIFIER_MAX_LENGTH && !/\s/.test(text);
}

/** An encrypted resource's service ("DOCUMENT_PRIVATE"): its identifier isn't repeated back. */
export function isPrivateService(service: string): boolean {
  return service.endsWith('_PRIVATE');
}

export interface IdentifierHits {
  rows: QdnRow[];
  /** More resources have this identifier than are listed. */
  more: boolean;
}

/** searchIdentifier's key. */
export function identifierKey(identifier: string): string {
  return `xqdnid:${identifier}`;
}

/** The resources published under exactly `identifier`, newest first. */
export function searchIdentifier(
  identifier: string,
  options: { force?: boolean } = {}
): Promise<IdentifierHits> {
  return fetchQuery(
    identifierKey(identifier),
    async () => {
      const page = await searchQdn(
        { identifier, prefix: false, maxPages: 1, pageSize: IDENTIFIER_HITS + 1 },
        options
      );
      return {
        rows: page.rows.slice(0, IDENTIFIER_HITS),
        more: page.rows.length > IDENTIFIER_HITS,
      };
    },
    { ttlMs: 3 * 60_000, force: options.force }
  );
}

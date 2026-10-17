/**
 * Connections → In common: where its first QORT came from (worded by the
 * kind of transaction, with how busy a payer that account is), the
 * sponsor it shares with others ("Also sponsored by A (47 others)", to
 * that sponsor's sponsees), and, when it has sent payments, who got their
 * first QORT payment from it (a page of its own, read on request). Its
 * reads are in useInCommon.ts. With the tab's search, only the rows it
 * finds: matches first, then those only similar; nothing when none.
 */
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link, Typography } from '@mui/material';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import { Section } from '../../../../components/common/Section';
import { ErrorState, ListSkeleton } from '../../../../components/common/states';
import { TxSentence } from '../../../../components/explorer/TxSentence';
import type { FirstSeen, Funding } from '../../../../data/explorer/account';
import { explorerFundedPath, explorerSponseesPath } from '../../../../routes/paths';
import { fundingParts, siblingsParts } from '../../../../rules/explorer/connections';
import { formatCount, formatDate } from '../../../../utils/format';
import { ConnectionRow, ROW_LIST_SX } from './ConnectionRow';
import type { MinterMarks } from './hooks';
import type { InCommonData } from './useInCommon';
import { FIELD_BLOCK_SX } from '../../../../components/explorer/fieldBlock';
import { SimilarHeading } from '../../../../components/explorer/search/SimilarHeading';
import type { MatchStrength } from '../../../../utils/fuzzySearch';

/** How the tab's search finds each of its rows (null: not found, or not there). */
export interface InCommonFound {
  funding: MatchStrength | null;
  siblings: MatchStrength | null;
  funded: MatchStrength | null;
}

const LINK_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.5,
  minHeight: 44,
  fontWeight: 600,
  overflowWrap: 'anywhere',
} as const;

function FirstQort({
  address,
  accountLabel,
  funding,
  band,
  marks,
  tag = null,
}: {
  address: string;
  accountLabel: string;
  funding: Funding;
  band: InCommonData['band'];
  marks: MinterMarks;
  /** One more plain tag (the search's "holds the name …"). */
  tag?: string | null;
}) {
  const parts = fundingParts(funding, band);
  const when = `${formatDate(funding.timestamp)} · block ${formatCount(funding.height)}`;
  if (!funding.from)
    return (
      <Box component="li" sx={FIELD_BLOCK_SX}>
        <Typography>
          <TxSentence parts={parts} quiet />
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {when}
        </Typography>
      </Box>
    );
  return (
    <ConnectionRow
      address={address}
      accountLabel={accountLabel}
      other={funding.from}
      parts={parts}
      when={when}
      tags={[marks.markOf(funding.from), marks.devOf(funding.from), tag]}
      evidence={{ words: '1 transaction', signature: funding.signature }}
    />
  );
}

export function InCommonSection({
  address,
  accountLabel,
  data,
  marks,
  sentAny,
  found = null,
  typed = '',
  tagOf,
}: {
  address: string;
  accountLabel: string;
  data: InCommonData;
  marks: MinterMarks;
  /** It has sent payments, so it may have made someone's first one. */
  sentAny: boolean;
  /** The tab's search, when one is typed: how it finds each row. */
  found?: InCommonFound | null;
  typed?: string;
  /** "holds the name “…”" for an account the search found by a name it holds. */
  tagOf?: (address: string) => string | null;
}) {
  const { first, sponsor, sponsorLinks, siblings, siblingsCapped, band } = data;
  const funding = (first.data as FirstSeen | undefined)?.funding ?? null;
  const loading = first.isLoading || (sponsor !== null && sponsorLinks.isLoading);
  const hasSiblings = sponsor !== null && siblings !== null && siblings > 0;
  if (!loading && !funding && !hasSiblings && !sentAny && !first.isError && !sponsorLinks.isError)
    return null;
  // Its rows, each with how the search finds it ('match' for every row with no search).
  const strength = (key: keyof InCommonFound): MatchStrength | null =>
    found ? found[key] : 'match';
  const rows: Array<{ strength: MatchStrength | null; node: ReactNode }> = [];
  if (funding)
    rows.push({
      strength: strength('funding'),
      node: (
        <FirstQort
          key="funding"
          address={address}
          accountLabel={accountLabel}
          funding={funding}
          band={band}
          marks={marks}
          tag={funding.from && found ? (tagOf?.(funding.from) ?? null) : null}
        />
      ),
    });
  if (hasSiblings)
    rows.push({
      strength: strength('siblings'),
      node: (
        <ConnectionRow
          key="siblings"
          address={address}
          accountLabel={accountLabel}
          other={sponsor}
          parts={siblingsParts(sponsor, siblings)}
          when={`Its reward shares to others: ${data.siblingsSpan}${
            siblingsCapped ? ' (its newest 500 transactions read)' : ''
          }`}
          tags={[
            marks.markOf(sponsor),
            marks.devOf(sponsor),
            'its sponsor',
            found ? (tagOf?.(sponsor) ?? null) : null,
          ]}
          extra={
            <Link component={RouterLink} to={explorerSponseesPath(sponsor)} sx={LINK_SX}>
              The {formatCount(siblings + 1)}
              {siblingsCapped ? '+' : ''} accounts it sponsored
              <ChevronRightOutlinedIcon fontSize="small" aria-hidden />
            </Link>
          }
        />
      ),
    });
  if (sentAny)
    rows.push({
      strength: strength('funded'),
      node: (
        <Box component="li" key="funded">
          <Link component={RouterLink} to={explorerFundedPath(address)} sx={LINK_SX}>
            Who got their first QORT payment from this account
            <ChevronRightOutlinedIcon fontSize="small" aria-hidden />
          </Link>
        </Box>
      ),
    });
  const matches = rows.filter((row) => row.strength === 'match');
  const similar = rows.filter((row) => row.strength === 'similar');
  // Searching, and nothing here is found: the part steps aside.
  if (found && !matches.length && !similar.length && !loading) return null;
  return (
    <Section title="In common" id="connections-common">
      {matches.length ? (
        <Box component="ul" aria-label="In common" sx={ROW_LIST_SX}>
          {matches.map((row) => row.node)}
        </Box>
      ) : null}
      {similar.length ? (
        <>
          <SimilarHeading typed={typed} />
          <Box component="ul" aria-label={`In common, similar to “${typed}”`} sx={ROW_LIST_SX}>
            {similar.map((row) => row.node)}
          </Box>
        </>
      ) : null}
      {loading ? <ListSkeleton count={1} label="Loading what it has in common" /> : null}
      {first.isError && !first.data ? (
        <ErrorState
          compact
          title="Couldn’t find where its first QORT came from."
          error={first.error}
          onRetry={() => void first.refetch()}
        />
      ) : null}
      {sponsorLinks.isError && !sponsorLinks.data ? (
        <ErrorState
          compact
          title="Couldn’t read its sponsor’s reward shares."
          error={sponsorLinks.error}
          onRetry={() => void sponsorLinks.refetch()}
        />
      ) : null}
    </Section>
  );
}

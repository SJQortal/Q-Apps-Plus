/**
 * Connections → In common: where its first QORT came from (worded by the
 * kind of transaction, with how busy a payer that account is), the
 * sponsor it shares with others ("Also sponsored by A (47 others)", to
 * that sponsor's sponsees), and, when it has sent payments, who got their
 * first QORT payment from it (a page of its own, read on request). Its
 * reads are in useInCommon.ts.
 */
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
}: {
  address: string;
  accountLabel: string;
  funding: Funding;
  band: InCommonData['band'];
  marks: MinterMarks;
}) {
  const parts = fundingParts(funding, band);
  const when = `${formatDate(funding.timestamp)} · block ${formatCount(funding.height)}`;
  if (!funding.from)
    return (
      <Box component="li" sx={FIELD_BLOCK_SX}>
        <Typography>
          <TxSentence parts={parts} plain />
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
      tags={[marks.markOf(funding.from)]}
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
}: {
  address: string;
  accountLabel: string;
  data: InCommonData;
  marks: MinterMarks;
  /** It has sent payments, so it may have made someone's first one. */
  sentAny: boolean;
}) {
  const { first, sponsor, sponsorLinks, siblings, siblingsCapped, band } = data;
  const funding = (first.data as FirstSeen | undefined)?.funding ?? null;
  const loading = first.isLoading || (sponsor !== null && sponsorLinks.isLoading);
  const hasSiblings = sponsor !== null && siblings !== null && siblings > 0;
  if (!loading && !funding && !hasSiblings && !sentAny && !first.isError && !sponsorLinks.isError)
    return null;
  return (
    <Section title="In common" id="connections-common">
      <Box component="ul" aria-label="In common" sx={ROW_LIST_SX}>
        {funding ? (
          <FirstQort
            address={address}
            accountLabel={accountLabel}
            funding={funding}
            band={band}
            marks={marks}
          />
        ) : null}
        {hasSiblings ? (
          <ConnectionRow
            address={address}
            accountLabel={accountLabel}
            other={sponsor}
            parts={siblingsParts(sponsor, siblings)}
            when={`Its reward shares to others: ${data.siblingsSpan}${
              siblingsCapped ? ' (its newest 500 transactions read)' : ''
            }`}
            tags={[marks.markOf(sponsor), 'its sponsor']}
            extra={
              <Link component={RouterLink} to={explorerSponseesPath(sponsor)} sx={LINK_SX}>
                The {formatCount(siblings + 1)}
                {siblingsCapped ? '+' : ''} accounts it sponsored
                <ChevronRightOutlinedIcon fontSize="small" aria-hidden />
              </Link>
            }
          />
        ) : null}
        {sentAny ? (
          <Box component="li">
            <Link component={RouterLink} to={explorerFundedPath(address)} sx={LINK_SX}>
              Who got their first QORT payment from this account
              <ChevronRightOutlinedIcon fontSize="small" aria-hidden />
            </Link>
          </Box>
        ) : null}
      </Box>
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

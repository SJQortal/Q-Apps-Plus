/**
 * One thing recorded between two compared accounts: the sentence (people
 * link to their accounts), when it happened, and a separate 44 px toggle
 * that opens what stands behind it: each transaction as a sentence with its
 * date and a link to it, or each trade with its date and its AT. Records
 * (nominations, supports, votes) have nothing to open: their date is said.
 */
import { useId } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { ExpandChevron } from '../../../components/common/ExpandChevron';
import { SmoothReveal } from '../../../components/common/SmoothReveal';
import { TxSentence } from '../../../components/explorer/TxSentence';
import type { Trade } from '../../../data/explorer/compare';
import { useDisplayName } from '../../../hooks/useDisplayName';
import type { PairFinding } from '../../../rules/explorer/compare';
import { formatAmount } from '../../../rules/explorer/txWords';
import { formatDate } from '../../../utils/format';
import { AtLink, EvidenceList } from '../account/connections/ConnectionRow';
import { blocksLine } from '../account/connections/words';
import { findingWhen } from './compareView';
import { LIST_SX } from './parts';
import { useViewState } from '../../../hooks/useViewState';

function TradeList({ trades }: { trades: readonly Trade[] }) {
  return (
    <Box
      component="ul"
      sx={{ ...LIST_SX, gap: 0.5, mt: 0.5, pl: 1.5, borderLeft: 2, borderColor: 'divider' }}
    >
      {trades.map((trade) => (
        <Box component="li" key={`${trade.atAddress}:${trade.timestamp}`} sx={{ minWidth: 0 }}>
          <Typography variant="body2">
            <Box component="strong" sx={{ whiteSpace: 'nowrap' }}>
              {formatAmount(trade.qortAmount)} QORT
            </Box>{' '}
            · {formatDate(trade.timestamp)}
          </Typography>
          {trade.atAddress ? <AtLink address={trade.atAddress} /> : null}
        </Box>
      ))}
    </Box>
  );
}

function toggleLabel(finding: PairFinding, actor: string, other: string): string {
  const words = finding.evidenceWords;
  switch (finding.kind) {
    case 'rewardShare':
      return `Show the ${words} of ${actor}’s reward share to ${other}`;
    case 'levelMove':
      return `Show the level move from ${actor} to ${other}`;
    case 'nameDeal':
      return `Show the name purchase by ${actor} from ${other}`;
    default:
      return `Show the ${words} from ${actor} to ${other}`;
  }
}

export function FindingRow({
  finding,
  viewpoint,
  privs,
}: {
  finding: PairFinding;
  /** Whose side the evidence sentences are told from. */
  viewpoint: string;
  privs?: Readonly<Record<string, string | null>>;
}) {
  // Kept for Back (useViewState), by the newest transaction behind it.
  const [open, setOpen] = useViewState(
    `finding:${finding.actor}:${finding.evidence[0]?.signature ?? ''}`,
    false
  );
  const id = useId();
  const actor = useDisplayName(finding.actor).label;
  const other = useDisplayName(finding.other).label;
  const opens = Boolean(finding.evidenceWords);
  return (
    <Box component="li" sx={{ minWidth: 0 }}>
      {/* A div: the people in the sentence are links. */}
      <Typography component="div" sx={{ overflowWrap: 'anywhere' }}>
        <TxSentence parts={finding.parts} />
      </Typography>
      {/* Payments and trades say their dates in the sentence already. */}
      {finding.kind === 'trade' ? null : (
        <Typography variant="body2" color="text.secondary">
          {finding.kind === 'payment' && finding.height !== undefined
            ? blocksLine(finding.firstHeight ?? finding.height, finding.height)
            : findingWhen(finding)}
        </Typography>
      )}
      {opens ? (
        <>
          <Button
            size="small"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={id}
            aria-label={toggleLabel(finding, actor, other)}
            endIcon={<ExpandChevron open={open} />}
            sx={{ minHeight: 44, fontSize: 14, px: 1, ml: -1 }}
          >
            {finding.evidenceWords}
          </Button>
          <Box id={id}>
            <SmoothReveal open={open}>
              {finding.trades ? (
                <TradeList trades={finding.trades} />
              ) : (
                <EvidenceList txs={finding.evidence} viewpoint={viewpoint} privs={privs} />
              )}
            </SmoothReveal>
          </Box>
        </>
      ) : null}
    </Box>
  );
}

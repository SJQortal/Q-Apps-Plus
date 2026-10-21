/**
 * A decision that is no longer waiting, on its own page: what it was and
 * about whom, who proposed it, how it ended and when (approved, rejected,
 * expired, not applied, or applied at once before MINTER needed
 * approvals), and which Minter Admins approved and rejected it, in two
 * columns (AnswerColumns). Minter Admins also see its proposer's note for
 * the Minter Admins (AdminNote).
 */
import { Box, Typography, type ChipProps } from '@mui/material';
import type { ChainNow } from '../../data/chain';
import type { DecisionLink } from '../../data/decisionLink';
import { PersonChip, PersonInline } from '../../components/common/Person';
import { AnswerColumns, type AnswerPerson } from '../../components/decision/AnswerColumns';
import { AdminNote } from '../../components/decision/AdminNote';
import { decisionNoteTarget } from '../../data/adminNotes';
import { Card, ToneChip } from '../../components/common/Section';
import { useDisplayName } from '../../hooks/useDisplayName';
import {
  decisionKind,
  decisionSubject,
  decisionTitle,
  isOwnAdminChange,
} from '../../rules/decision';
import { OUTCOME_LABEL, outcomeSentence, type DecisionOutcome } from '../../rules/outcome';
import { formatBlock, formatDate } from '../../utils/format';
import { banLengthText } from './decisionUi';

type Decided = Extract<DecisionLink, { kind: 'decided' }>;

const OUTCOME_CHIP: Record<
  Exclude<DecisionOutcome, 'pending'>,
  { color: ChipProps['color']; variant: ChipProps['variant'] }
> = {
  approved: { color: 'success', variant: 'filled' },
  applied: { color: 'success', variant: 'outlined' },
  rejected: { color: 'error', variant: 'outlined' },
  expired: { color: 'default', variant: 'outlined' },
  invalid: { color: 'warning', variant: 'outlined' },
};

/** When a block was made (ms), estimated from the transaction's own block and the block pace. */
function blockTime(link: Decided, height: number, now: ChainNow): number {
  const own = link.tx.blockHeight;
  return typeof own === 'number'
    ? link.tx.timestamp + (height - own) * now.msPerBlock
    : link.tx.timestamp;
}

export function DecidedCard({
  link,
  now,
  adminNames,
}: {
  link: Decided;
  now: ChainNow;
  /** Admin addresses → names, when known (others are looked up). */
  adminNames: Map<string, string | null>;
}) {
  const { tx, outcome } = link;
  const kind = decisionKind(tx);
  const subject = decisionSubject(tx);
  const creator = tx.creatorAddress ?? null;
  const facts = { kind, subject, creatorAddress: creator, decline: link.decline };
  const title = decisionTitle(facts);
  const who = useDisplayName(subject ?? '', subject ? undefined : null);
  const chip = OUTCOME_CHIP[outcome];
  const reason = typeof tx.reason === 'string' && tx.reason.trim() ? tx.reason.trim() : null;
  const person = (r: { creatorAddress?: string }): AnswerPerson => ({
    address: r.creatorAddress as string,
    name: adminNames.has(r.creatorAddress as string)
      ? adminNames.get(r.creatorAddress as string)
      : undefined,
  });
  // The proposer's note for the Minter Admins (an invite's is its nomination's, not read here).
  const noteTarget =
    kind !== 'invite' && creator
      ? decisionNoteTarget({
          signature: tx.signature,
          kind,
          subject,
          createdAt: tx.timestamp,
          creatorAddress: creator,
        })
      : null;
  const approvers = link.approvals.filter((r) => r.creatorAddress).map(person);
  const rejecters = link.rejections.filter((r) => r.creatorAddress).map(person);

  return (
    <Card
      as="article"
      aria-label={subject ? `${title}, ${who.label}` : title}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Typography component="h3" sx={{ fontWeight: 700, fontSize: 16 }}>
          {title}
        </Typography>
        <ToneChip
          size="small"
          label={OUTCOME_LABEL[outcome]}
          color={chip.color}
          variant={chip.variant}
        />
      </Box>
      {subject ? <PersonChip address={subject} size={40} /> : null}

      {kind === 'ban' || reason ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {kind === 'ban' ? (
            <Typography variant="body2">
              <Box component="span" sx={{ fontWeight: 700 }}>
                Length:
              </Box>{' '}
              {banLengthText(Number(tx.timeToLive ?? 0))}
            </Typography>
          ) : null}
          {reason ? (
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              <Box component="span" sx={{ fontWeight: 700 }}>
                Reason:
              </Box>{' '}
              {reason}
            </Typography>
          ) : null}
        </Box>
      ) : null}

      <AdminNote target={noteTarget} near label={subject ? `${title}: ${who.label}` : title} />

      {creator ? (
        <Typography component="div" variant="body2" color="text.secondary">
          {isOwnAdminChange(facts) ? (
            'Their own proposal, '
          ) : (
            <>
              Proposed by <PersonInline address={creator} name={adminNames.get(creator)} />,{' '}
            </>
          )}
          {formatDate(tx.timestamp)}
          {typeof tx.blockHeight === 'number' ? ` (${formatBlock(tx.blockHeight)})` : ''}.
        </Typography>
      ) : null}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        <Typography>{outcomeSentence(outcome, kind)}</Typography>
        {link.decidedAt !== null ? (
          <Typography variant="body2" color="text.secondary">
            {outcome === 'expired' ? 'Expired' : 'Decided'} in {formatBlock(link.decidedAt)},{' '}
            {formatDate(blockTime(link, link.decidedAt, now))}.
          </Typography>
        ) : null}
      </Box>

      {outcome === 'applied' ? null : link.signaturesUnread ? (
        <Typography variant="body2" color="text.secondary">
          Couldn’t read who approved it on your node.
        </Typography>
      ) : (
        <AnswerColumns
          approved={approvers}
          rejected={rejecters}
          considering={null}
          emptyText="None"
        />
      )}
    </Card>
  );
}

/**
 * A decision that is no longer waiting, on its own page: what it was and
 * about whom, who proposed it, how it ended and when (approved, rejected,
 * expired, not applied, or applied at once before MINTER needed
 * signatures), and which Minter Admins signed it.
 */
import { Box, Typography, type ChipProps } from '@mui/material';
import type { ChainNow } from '../../data/chain';
import type { DecisionLink } from '../../data/decisionLink';
import { AvatarStack, PersonChip, PersonInline } from '../../components/common/Person';
import { Card, ToneChip } from '../../components/common/Section';
import { useDisplayName } from '../../hooks/useDisplayName';
import {
  decisionKind,
  decisionSubject,
  decisionTitle,
  isOwnAdminChange,
} from '../../rules/decision';
import { OUTCOME_LABEL, outcomeSentence, type DecisionOutcome } from '../../rules/outcome';
import { formatBlock, formatCount, formatDate, plural } from '../../utils/format';
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

/** "Signed by 8 Minter Admins.", "Signed by 3 Minter Admins; 1 rejected it." */
function signersLine(signed: number, rejected: number): string {
  const yes = signed ? `Signed by ${plural(signed, 'Minter Admin')}` : 'No Minter Admin signed it';
  return rejected ? `${yes}; ${formatCount(rejected)} rejected it.` : `${yes}.`;
}

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
  const facts = { kind, subject, creatorAddress: creator };
  const title = decisionTitle(facts);
  const who = useDisplayName(subject ?? '', subject ? undefined : null);
  const chip = OUTCOME_CHIP[outcome];
  const reason = typeof tx.reason === 'string' && tx.reason.trim() ? tx.reason.trim() : null;
  const signers = link.approvals
    .filter((r) => r.creatorAddress)
    .map((r) => ({
      address: r.creatorAddress as string,
      name: adminNames.has(r.creatorAddress as string)
        ? adminNames.get(r.creatorAddress as string)
        : undefined,
    }));

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
          Couldn’t read who signed it on your node.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {signersLine(signers.length, link.rejections.length)}
          </Typography>
          {signers.length ? (
            <AvatarStack
              people={signers}
              label={`Signed by ${plural(signers.length, 'Minter Admin')}`}
              max={10}
              showNames
            />
          ) : null}
        </Box>
      )}
    </Card>
  );
}

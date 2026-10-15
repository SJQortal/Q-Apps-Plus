/**
 * "How approving works", folded away: the rules every Minter Admin should
 * know, with today's real numbers (target, admins, window, block time),
 * including that proposing comes with the proposer's own approval, what
 * Reject does on chain (also after approving), and that admin changes move
 * the target for everything waiting (approve them in a planned order).
 */
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { ChainNow } from '../../data/chain';
import type { GroupInfo } from '../../data/types';
import { describeThreshold } from '../../rules/threshold';
import { formatQort } from '../../data/accounts';
import { useFee } from '../../hooks/useFee';
import { formatCount, formatDuration } from '../../utils/format';

export function HowSigningWorks({
  group,
  now,
  needed,
  totalAdmins,
  signers,
}: {
  group: GroupInfo;
  now: ChainNow;
  needed: number;
  totalAdmins: number;
  signers: number;
}) {
  const fee = useFee('GROUP_APPROVAL');
  const feeText = formatQort(fee.data?.qort ?? 0.01);
  const blockSeconds = Math.round(now.msPerBlock / 100) / 10;
  const window = group.maximumBlockDelay;
  const points = [
    `An approval counts once it is in a block. Each one is a Hub confirmation (Hub shows it as a GROUP_APPROVAL) and costs ${feeText}.`,
    `A proposal doesn’t count as its proposer’s approval, so when you propose something here you approve it straight after: two Hub confirmations, one after the other. A nomination’s first approval works the same way.`,
    `Only your latest answer counts.`,
    `If you don’t agree, press Reject, or do nothing and let it expire. A rejection costs ${feeText} too and counts once it is in a block. Rejections are measured against the same target as approvals: ${needed} of them end it as rejected. Approvals are counted first, so with ${needed} of both it is approved. A rejection takes nothing from anyone else’s approval.`,
    `Changed your mind after approving? Press Reject: an approval can’t be taken back on chain, so a rejection replaces it, because only your latest answer counts. You can still approve again later while there is time.`,
    `Doing nothing lets it expire ${formatCount(window + 1)} blocks after the block it went into (about ${formatDuration((window + 1) * now.msPerBlock, { precise: true })} at today’s ${blockSeconds} s a block). The last block an approval can count in is two blocks before that.`,
    `Core applies a decision by itself in the block where it reaches the target. Nobody has to press anything afterwards.`,
    `It can be applied at the earliest ${formatCount(group.minimumBlockDelay + 1)} blocks after the block it went into; approvals sent before then still count.`,
    `The target is ${describeThreshold(group.approvalThreshold)}, recounted every block: ${needed} of ${totalAdmins} today. MINTER’s owner account counts as an admin but can’t approve, so ${signers} people can.`,
    `Adding or removing a Minter Admin moves the target for every waiting decision, also the ones that already have approvals. When the target drops to what a decision already has, Core applies it at once, in the same block or the next, with no new approval.`,
    `So before approving an admin change, look at what it would tip over (its card says, and a chip marks each one): settle those first or let them expire, or agree the order with the other Minter Admins.`,
  ];
  return (
    <Accordion
      disableGutters
      elevation={0}
      // A part of the page of its own, like the sections above it (not under the last one).
      slotProps={{ heading: { component: 'h2' } }}
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        '&::before': { display: 'none' },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 48 }}>
        <Typography sx={{ fontWeight: 700 }}>How approving works</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box
          component="ul"
          sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          {points.map((p) => (
            <Typography component="li" key={p} variant="body2">
              {p}
            </Typography>
          ))}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

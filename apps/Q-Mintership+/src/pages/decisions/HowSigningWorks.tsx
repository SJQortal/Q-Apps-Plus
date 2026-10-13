/**
 * "How signing works", folded away: the rules every Minter Admin should
 * know, with today's real numbers (target, admins, window, block time),
 * including that proposing comes with the proposer's own signature.
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
  const blockSeconds = Math.round(now.msPerBlock / 100) / 10;
  const window = group.maximumBlockDelay;
  const points = [
    `A signature counts once it is in a block. Each one is a Hub confirmation and costs ${formatQort(fee.data?.qort ?? 0.01)}.`,
    `A proposal doesn’t count as its proposer’s signature, so when you propose something here you sign it straight after: two Hub confirmations, one after the other. A nomination’s first signature works the same way.`,
    `Only your latest answer counts.`,
    `There is no reject or withdraw button: on chain, taking a signature back counts as a rejection. If you don’t agree, do nothing and let it expire.`,
    `Doing nothing lets it expire ${formatCount(window + 1)} blocks after the block it went into (about ${formatDuration((window + 1) * now.msPerBlock, { precise: true })} at today’s ${blockSeconds} s a block). The last block a signature can count in is two blocks before that.`,
    `Core applies a decision by itself in the block where it reaches the target. Nobody has to press anything afterwards.`,
    `It can be applied at the earliest ${formatCount(group.minimumBlockDelay + 1)} blocks after the block it went into; signatures sent before then still count.`,
    `The target is ${describeThreshold(group.approvalThreshold)}, recounted every block: ${needed} of ${totalAdmins} today. MINTER’s owner account counts as an admin but can’t sign, so ${signers} people can.`,
  ];
  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        '&::before': { display: 'none' },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 48 }}>
        <Typography sx={{ fontWeight: 700 }}>How signing works</Typography>
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
